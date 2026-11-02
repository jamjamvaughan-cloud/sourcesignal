#!/usr/bin/env tsx
/**
 * SourceSignal ingestion worker — main entry point.
 *
 * Runs the ingestion pipeline over all enabled source adapters:
 *   1. Discover records
 *   2. Fetch and preserve source evidence
 *   3. Normalise into common schema
 *   4. Canonicalise (generate canonical ID + source hash)
 *   5. Deduplicate (skip already-processed canonical IDs)
 *   6. Extract structured fields (NVIDIA API or rule-based)
 *   7. Upsert into PocketBase idempotently
 *   8. Record run status, counts, retries, and failures
 *
 * Usage:
 *   npm run dev          # watch mode (development)
 *   npm run ingest       # run once and exit
 *   npm start            # run as a long-running process (15-min polling)
 */

import PocketBase from "pocketbase";
import { ADAPTERS, getEnabledAdapters } from "./pipeline/registry";
import { normaliseRecord } from "./pipeline/normalise";
import {
  canonicalise,
  isDuplicate,
  hasSourceChanged,
} from "./pipeline/canonicalise";
import { extractFields } from "./pipeline/extract";
import { upsertOpportunity } from "./pipeline/upsert";
import type { IngestionResult, IngestionRunStats } from "./types";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let running = true;

const SERVICE_NAME = process.env.SERVICE_NAME ?? "sourcesignal-worker";

function log(level: "debug" | "info" | "warn" | "error", message: string, meta: Record<string, unknown> = {}): void {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    ...meta,
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

function handleShutdown() {
  running = false;
  log("info", "Shutdown signal received. Finishing current run...");
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

/**
 * Returns an authenticated PocketBase admin client.
 * Reads credentials from server-only environment variables.
 * Uses typed auth pattern consistent with src/lib/pb-server.ts.
 */
function getAdminPb(): Promise<PocketBase | null> {
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL;

  if (!email || !password || !url) {
    log("warn", "Missing PocketBase admin credentials.", {
      required: ["POCKETBASE_ADMIN_EMAIL", "POCKETBASE_ADMIN_PASSWORD", "NEXT_PUBLIC_POCKETBASE_URL"],
    });
    return Promise.resolve(null);
  }

  try {
    const pb = new PocketBase(url);
    return pb
      .collection("_superusers")
      .authWithPassword(email, password)
      .then(() => pb)
      .catch((err: unknown) => {
        log("error", "Failed to authenticate as PocketBase admin.", {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
  } catch (err) {
    log("error", "Failed to authenticate as PocketBase admin.", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Promise.resolve(null);
  }
}

/**
 * Run a single ingestion cycle across all enabled adapters.
 */
async function runIngestionCycle(): Promise<IngestionResult[]> {
  const pb = await getAdminPb();
  if (!pb) {
    return [];
  }

  // Fetch existing canonical IDs for deduplication.
  const existingCanonicalIds = new Set<string>();
  try {
    const existing = await pb.collection("opportunities").getFullList({
      fields: "canonical_id",
    });
    for (const item of existing) {
      if (item.canonical_id) {
        existingCanonicalIds.add(item.canonical_id);
      }
    }
  } catch (err) {
    console.warn(
      "[worker] Could not fetch existing canonical IDs:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const adapters = getEnabledAdapters();
  const results: IngestionResult[] = [];

  for (const adapter of adapters) {
    const startedAt = new Date().toISOString();
    const stats: IngestionRunStats = {
      discovered: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    const errors: IngestionResult["errors"] = [];

    log("info", `Starting ingestion from adapter: ${adapter.name}`, { adapter: adapter.name });

    try {
      const records = await adapter.discover();
      // Tag each record with the adapter's country for country-based isolation.
      // This ensures UK records never leak into US results, US into AU, etc.
      const taggedRecords = records.map((r) => ({
        ...r,
        country: r.country ?? adapter.country,
      }));
      stats.discovered = taggedRecords.length;

      for (const record of taggedRecords) {
        try {
          // Step 2: Fetch evidence (preserve source snapshot).
          const enrichedRecord = adapter.fetchEvidence
            ? await adapter.fetchEvidence(record)
            : record;

          // Step 3: Normalise.
          const normalised = normaliseRecord(enrichedRecord);
          if (!normalised) {
            stats.skipped++;
            continue;
          }

          // Step 4: Canonicalise.
          const canonicalised = canonicalise(normalised, enrichedRecord);

          // Step 5: Deduplicate by canonical ID.
          if (isDuplicate(canonicalised, existingCanonicalIds)) {
            const existingHash = await getExistingSourceHash(
              pb,
              canonicalised.canonicalId,
            );
            if (!hasSourceChanged(canonicalised, existingHash)) {
              stats.skipped++;
              continue;
            }
          }

          // Step 6: Extract structured fields.
          const extraction = await extractFields(canonicalised);

          // Step 7: Upsert into PocketBase.
          const upsertResult = await upsertOpportunity(pb, {
            ...canonicalised,
            confidence: extraction.confidence,
          });

          if (upsertResult.inserted) stats.inserted++;
          else if (upsertResult.updated) stats.updated++;

          // Track canonical ID for subsequent dedup checks in this run.
          existingCanonicalIds.add(canonicalised.canonicalId);

          log("info", `${upsertResult.inserted ? "inserted" : upsertResult.updated ? "updated" : "skipped"}: ${canonicalised.title}`, {
            canonical_id: canonicalised.canonicalId,
            title: canonicalised.title,
            status: upsertResult.inserted ? "inserted" : upsertResult.updated ? "updated" : "skipped",
          });
        } catch (err) {
          stats.failed++;
          errors.push({
            source: adapter.name,
            message: err instanceof Error ? err.message : String(err),
            retryCount: 0,
          });
          log("error", `Failed to process record ${record.sourceId}: ${err instanceof Error ? err.message : String(err)}`, {
            source: adapter.name,
            source_id: record.sourceId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      stats.failed++;
      errors.push({
        source: adapter.name,
        message:
          err instanceof Error ? err.message : "Adapter discovery failed.",
        retryCount: 0,
      });
      log("error", `Adapter ${adapter.name} failed: ${err instanceof Error ? err.message : String(err)}`, {
        source: adapter.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const finishedAt = new Date().toISOString();
    const status =
      stats.failed > 0 && (stats.inserted + stats.updated) === 0
        ? "failed"
        : stats.failed > 0
          ? "partial"
        : "completed";

    results.push({
      source: adapter.name,
      status,
      stats,
      errors,
      startedAt,
      finishedAt,
    });

    // Record run in PocketBase ingestion_runs collection.
    try {
      await pb.collection("ingestion_runs").create({
        started_at: startedAt,
        finished_at: finishedAt,
        status,
        discovered: stats.discovered,
        inserted: stats.inserted,
        updated_count: stats.updated,
        skipped: stats.skipped,
        failed: stats.failed,
        source: adapter.name,
      });
    } catch (err) {
      log("warn", "Could not record ingestion run.", {
        source: adapter.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Get existing source hash for a canonical ID (for change detection).
 */
async function getExistingSourceHash(
  pb: PocketBase,
  canonicalId: string,
): Promise<string | undefined> {
  try {
    const record = await pb
      .collection("opportunities")
      .getFirstListItem(`canonical_id = "${canonicalId}"`, {
        fields: "source_hash",
      });
    return record.source_hash as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Run ingestion once and exit (for development and manual triggering).
 */
async function runOnce(): Promise<void> {
  log("info", "Running single ingestion cycle...");
  const results = await runIngestionCycle();
  for (const result of results) {
    log("info", `${result.source}: ${result.status} (discovered=${result.stats.discovered}, inserted=${result.stats.inserted}, updated=${result.stats.updated}, skipped=${result.stats.skipped}, failed=${result.stats.failed})`, {
      source: result.source,
      status: result.status,
      stats: result.stats,
    });
  }
  process.exit(0);
}

/**
 * Run as a long-running process with 15-minute polling interval.
 */
async function runLongRunning(): Promise<void> {
  log("info", `Starting long-running ingestion (poll interval: ${POLL_INTERVAL_MS / 1000 / 60} minutes)...`, {
    poll_interval_ms: POLL_INTERVAL_MS,
  });

  while (running) {
    await runIngestionCycle();

    if (!running) break;

    log("info", `Sleeping for ${POLL_INTERVAL_MS / 1000 / 60} minutes until next poll...`, {
      poll_interval_minutes: POLL_INTERVAL_MS / 1000 / 60,
    });

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  log("info", "Shutdown complete.");
  process.exit(0);
}

const args = process.argv.slice(2);

if (args.includes("--once")) {
  runOnce().catch((err) => {
    log("error", "Fatal error:", { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
} else {
  runLongRunning().catch((err) => {
    log("error", "Fatal error:", { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
