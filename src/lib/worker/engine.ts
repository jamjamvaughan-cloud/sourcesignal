/**
 * 60-Second Delta Ingestion Engine.
 *
 * Runs all 24 source adapters concurrently every 60 seconds, fetching only
 * records published/updated in the last 60 seconds. Uses in-memory
 * deduplication to skip already-processed records, scores signals via the
 * signals engine, and batch-inserts into PostgreSQL.
 *
 * Designed for the SourceSignal ingestion worker (long-running process).
 * Also exposes `runDeltaIngestionCycle()` for one-off invocation.
 */

import { log } from "@/lib/logger";
import { query } from "@/lib/db";
import { computeSignalAndNormalize } from "@/lib/signals-engine";
import {
  matchSignalToRules,
  resolveOrCreateEntity,
} from "@/lib/entity-resolution";
import type { CountryCode, SourceRecord } from "@/types";
import { hashCanonicalId } from "../../../worker/src/utils/hash";

/** Adapter interface (minimal subset needed by the engine). */
interface DeltaSourceAdapter {
  readonly name: string;
  readonly enabled: boolean;
  readonly country: CountryCode;
  fetchDeltas?(params: { publishedAfter: string }): Promise<SourceRecord[]>;
  discover?(): Promise<SourceRecord[]>;
}

/** Shape of a scored signal ready for PostgreSQL insertion. */
interface ScoredSignalForDB extends Record<string, unknown> {
  canonical_id: string;
  title: string;
  sector: string;
  region: string;
  source_url: string;
  signal_tier: string;
  market_velocity: number;
  country_tag: string;
  sector_slug: string;
  intent: string;
  scored_at: string;
}

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const SERVICE_NAME = process.env.SERVICE_NAME ?? "sourcesignal-worker";

// In-memory deduplication cache: dedupeKey -> timestamp.
// Keys expire after 24 hours to prevent unbounded growth.
// Seeded from PostgreSQL on startup so worker restarts do not re-ingest
// recently processed records.
const DEDUPE_CACHE = new Map<string, number>();

/**
 * Seeds the in-memory dedup cache with canonical IDs already present in
 * PostgreSQL. This prevents re-ingestion of records after a worker restart.
 */
async function seedDedupeCache(): Promise<void> {
  try {
    const result = await query(`SELECT canonical_id FROM opportunities`);
    const records = result.rows as Array<{ canonical_id?: string }>;
    let seeded = 0;
    for (const item of records) {
      const canonicalId = item.canonical_id;
      if (!canonicalId) continue;
      DEDUPE_CACHE.set(canonicalId, Date.now());
      seeded++;
    }
    log("info", `Dedup cache seeded with ${seeded} existing canonical IDs`, {
      service: SERVICE_NAME,
      seeded,
    });
  } catch (err) {
    log("error", "Failed to seed dedup cache from PostgreSQL", {
      service: SERVICE_NAME,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function makeDedupeKey(
  sourceName: string,
  sourceUrl: string,
  sourceId: string,
): string {
  return hashCanonicalId(sourceName, sourceUrl, sourceId);
}

function isDedupeKeyRecent(key: string): boolean {
  const ts = DEDUPE_CACHE.get(key);
  if (!ts) return false;
  return Date.now() - ts < DEDUPE_TTL_MS;
}

function markDedupeKey(key: string): void {
  DEDUPE_CACHE.set(key, Date.now());
  // Periodically clean up expired entries.
  const now = Date.now();
  for (const [k, v] of DEDUPE_CACHE.entries()) {
    if (now - v > DEDUPE_TTL_MS) {
      DEDUPE_CACHE.delete(k);
    }
  }
}

/** Lazy loader map: adapter name -> dynamic import function. */
const ADAPTER_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  uk_contracts_finder: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/uk_contracts_finder"),
  uk_find_a_tender: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/uk_find_a_tender"),
  scotland_pcs: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/scotland_pcs"),
  scotland_pcs_tender: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/scotland_pcs_tender"),
  scotland_scottish_water: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/scotland_scottish_water"),
  uk_mod_dsp: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/uk_mod_dsp"),
  us_sam_gov: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/us_sam_gov"),
  us_usaspending: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/us_usaspending"),
  us_dla_dibbs: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/us_dla_dibbs"),
  us_caleprocure: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/us_caleprocure"),
  canada_buys: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/canada_buys"),
  canada_merx: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/canada_merx"),
  canada_provincial: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/canada_provincial"),
  ireland_etenders: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/ireland_etenders"),
  ireland_ogp: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/ireland_ogp"),
  ireland_esb_tii: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/ireland_esb_tii"),
  ireland_irish_water: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/ireland_irish_water"),
  au_austender: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/au_austender"),
  au_state_procurement: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/au_state_procurement"),
  au_defence: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/au_defence"),
  eu_ted: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/eu_ted"),
  eu_eprocurement: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/eu_eprocurement"),
  eu_eda: () =>
    // @ts-expect-error - worker modules resolved at runtime by tsx/Node.js
    import("../../worker/src/adapters/eu_eda"),
};

/**
 * Runs a single 60-second delta ingestion cycle across all adapters.
 * Fetches only records published/updated within the last 60 seconds,
 * deduplicates in memory, scores signals, and batch-inserts into PostgreSQL.
 */
export async function runDeltaIngestionCycle(): Promise<void> {
  const publishedAfter = new Date(Date.now() - POLL_INTERVAL_MS).toISOString();

  log("info", "Starting 60s delta ingestion cycle", {
    service: SERVICE_NAME,
    publishedAfter,
  });

  // Seed dedup cache with existing canonical IDs from PostgreSQL so worker
  // restarts do not re-ingest recently processed records.
  await seedDedupeCache();

  const newSignals: ScoredSignalForDB[] = [];
  let adapterFailures = 0;

  // Execute all adapters concurrently.
  const results = await Promise.allSettled(
    Object.entries(ADAPTER_LOADERS).map(async ([name, loader]) => {
      try {
        const mod = await loader();
        const adapter = mod.default as DeltaSourceAdapter;
        if (!adapter.enabled) {
          return;
        }

        const records = await (adapter.fetchDeltas
          ? adapter.fetchDeltas({ publishedAfter })
          : adapter.discover?.());

        const taggedRecords = (records as SourceRecord[]).map((r) => ({
          ...r,
          country: ((r as unknown as { country?: string }).country ??
            adapter.country) as CountryCode,
        }));

        for (const record of taggedRecords) {
          const dedupeKey = makeDedupeKey(
            record.sourceName,
            record.sourceUrl,
            record.sourceId,
          );

          if (isDedupeKeyRecent(dedupeKey)) {
            continue; // Already processed in this window.
          }

          const signal = await computeSignalAndNormalize(
            record,
            record.country as CountryCode,
          );
          markDedupeKey(dedupeKey);

          newSignals.push({
            canonical_id: signal.canonicalId,
            title: signal.title,
            sector: signal.sector,
            region: signal.region,
            source_url: signal.sourceUrl,
            signal_tier: signal.signalTier,
            market_velocity: signal.marketVelocity,
            country_tag: signal.countryTag,
            sector_slug: signal.sectorSlug,
            intent: signal.intent,
            scored_at: signal.scoredAt,
            ...(signal.summary ? { summary: signal.summary } : {}),
            ...(signal.buyer ? { buyer: signal.buyer } : {}),
            ...(signal.location ? { location: signal.location } : {}),
            ...(signal.latitude !== undefined ? { latitude: signal.latitude } : {}),
            ...(signal.longitude !== undefined ? { longitude: signal.longitude } : {}),
            ...(signal.publishedDate ? { published_date: signal.publishedDate } : {}),
            ...(signal.closingDate ? { closing_date: signal.closingDate } : {}),
            ...(signal.estimatedValue !== undefined ? { estimated_value: signal.estimatedValue } : {}),
            ...(signal.currency ? { currency: signal.currency } : {}),
            ...(signal.procurementStage ? { procurement_stage: signal.procurementStage } : {}),
            ...(signal.confidence !== undefined ? { confidence: signal.confidence } : {}),
            ...(signal.detailFields ? { detail_fields: signal.detailFields } : {}),
            ...(signal.cpvCode ? { cpv_code: signal.cpvCode } : {}),
          });
        }
      } catch (err) {
        adapterFailures++;
        log("error", `Adapter ${name} failed in delta cycle`, {
          service: SERVICE_NAME,
          adapter: name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  log("info", `Delta cycle complete: ${newSignals.length} new signals, ${adapterFailures} adapter failures (${fulfilled}/${results.length} adapters)`, {
    service: SERVICE_NAME,
    signalsCount: newSignals.length,
    adapterFailures,
    adaptersSettled: fulfilled,
    adaptersTotal: results.length,
  });

  // Batch insert new signals into PostgreSQL.
  if (newSignals.length > 0) {
    try {
      const results = await Promise.all(
        newSignals.map((signal) =>
          query(
            `INSERT INTO opportunities (id, canonical_id, title, sector, region, location, buyer, estimated_value, currency, procurement_stage, published_date, closing_date, confidence, signal_tier, source_url, source_hash, source_snapshot, vulnerability_trigger, detail_fields, cpv_code, is_demonstration, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
             RETURNING id`,
            [
              signal.canonical_id,
              signal.title,
              signal.sector,
              signal.region,
              signal.location ?? null,
              signal.buyer ?? null,
              signal.estimatedValue ?? null,
              signal.currency ?? null,
              signal.procurementStage ?? null,
              signal.publishedDate ?? null,
              signal.closingDate ?? null,
              signal.confidence ?? null,
              signal.signalTier,
              signal.source_url,
              signal.sourceHash ?? null,
              signal.sourceSnapshot ?? null,
              signal.vulnerabilityTrigger ?? null,
              signal.detailFields ?? null,
              signal.cpvCode ?? null,
              false,
            ],
          ),
        ),
      );

      // Fire-and-forget entity resolution + rule matching for each inserted signal.
      // These run asynchronously and do not block the ingestion cycle.
      for (const [idx, result] of results.entries()) {
        const opportunityId = (result.rows[0] as { id?: string } | null)?.id;
        const signal = newSignals[idx] as unknown as {
          canonical_id: string;
          title: string;
          sector: string;
          region: string;
          buyer?: string | null;
          estimatedValue?: number | null;
          currency?: string | null;
          signalTier: string;
          source_url: string;
          sourceHash?: string | null;
          sourceSnapshot?: string | null;
          vulnerabilityTrigger?: string | null;
        };
        if (opportunityId) {
          // Entity resolution + rule matching run asynchronously and do not
          // block the ingestion cycle.
          void resolveOrCreateEntity({
            canonical_id: signal.canonical_id,
            buyer: signal.buyer ?? null,
            buyer_canonical_id: undefined,
            estimated_value: signal.estimatedValue,
            currency: signal.currency,
            sector: signal.sector,
            region: signal.region,
            country: signal.region as CountryCode,
            signal_tier: signal.signalTier,
          }).then((matchResult) => {
            if (matchResult.profile) {
              return query(
                `INSERT INTO entity_profile_members (entity_profile_id, opportunity_id, match_reason, match_confidence, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT DO NOTHING`,
                [matchResult.profile.id, opportunityId, matchResult.matchReason, matchResult.matchConfidence],
              );
            }
          }).then(() => {
            return matchSignalToRules(
              null, // Match against all rules across organisations
              opportunityId,
              {
                title: signal.title,
                summary: undefined,
                buyer: signal.buyer ?? null,
                estimated_value: signal.estimatedValue,
                currency: signal.currency,
                signal_tier: signal.signalTier,
                vulnerability_trigger: signal.vulnerabilityTrigger,
                country: signal.region as CountryCode,
              },
            );
          }).catch((err) => {
            log("error", "Entity resolution failed for signal", {
              service: SERVICE_NAME,
              opportunityId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      }

      log("info", `Batch inserted ${newSignals.length} opportunities into PostgreSQL`, {
        service: SERVICE_NAME,
        inserted: newSignals.length,
      });
    } catch (err) {
      log("error", "Failed to batch insert opportunities into PostgreSQL", {
        service: SERVICE_NAME,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Start the long-running 60-second delta ingestion loop.
 * Runs one cycle immediately, then every 60 seconds thereafter.
 */
export function startDeltaIngestionLoop(): void {
  log("info", "Starting 60-second delta ingestion loop", {
    service: SERVICE_NAME,
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  // Run immediately on start.
  runDeltaIngestionCycle().catch((err) => {
    log("error", "Initial delta ingestion cycle failed", {
      service: SERVICE_NAME,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const interval = setInterval(() => {
    runDeltaIngestionCycle().catch((err) => {
      log("error", "Delta ingestion cycle failed", {
        service: SERVICE_NAME,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, POLL_INTERVAL_MS);

  // Allow process to exit even if interval is active.
  if (typeof interval.unref === "function") {
    interval.unref();
  }

  // Graceful shutdown.
  process.on("SIGINT", () => clearInterval(interval));
  process.on("SIGTERM", () => clearInterval(interval));
}

export { DEDUPE_CACHE, DEDUPE_TTL_MS, POLL_INTERVAL_MS };
export type { DeltaSourceAdapter, ScoredSignalForDB };
