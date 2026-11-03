/**
 * Primary-source ingestion runner.
 *
 * Fetches normalised records from every enabled adapter, computes a stable
 * SHA-256 source hash, and inserts them into the PostgreSQL `signals` table.
 * Duplicate rows are ignored via the unique `source_hash` constraint, making
 * repeated runs idempotent.
 *
 * Can be invoked once (CLI / cron) or as a long-running loop:
 *   npx tsx scripts/ingest-signals.ts --once
 *   npx tsx scripts/ingest-signals.ts --watch
 */

import { createHash } from "crypto";
import { query } from "../db";
import { error, info, warn } from "../logger";
import { SIGNAL_ADAPTERS } from "./adapters";
import {
  SIGNAL_OPPORTUNITY_TYPES,
  SIGNAL_SECTORS,
  type IngestionCycleResult,
  type IngestionOptions,
  type NormalisedSignal,
  type SignalIngestionResult,
  type SignalSourceAdapter,
} from "./types";

export interface RunIngestionOptions extends IngestionOptions {
  /** Override the adapter list (used by tests and targeted backfills). */
  adapters?: readonly SignalSourceAdapter[];
}

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

function singleSentence(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return collapsed;
  const match = collapsed.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : `${collapsed}.`;
}

function validHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Stable identity for dedupe: source + jurisdiction + source record ID. */
export function buildSourceHash(
  adapter: SignalSourceAdapter,
  signal: NormalisedSignal,
): string {
  const identity = signal.sourceId?.trim() || signal.sourceUrl.trim();
  return createHash("sha256")
    .update(
      [
        adapter.name,
        adapter.jurisdiction,
        signal.sourceName,
        identity,
      ].join("|"),
    )
    .digest("hex");
}

interface PreparedSignal {
  title: string;
  buyerName: string;
  jurisdiction: NormalisedSignal["jurisdiction"];
  sector: NormalisedSignal["sector"];
  opportunityType: NormalisedSignal["opportunityType"];
  estimatedValue: number | null;
  sourceName: string;
  sourceUrl: string;
  sourceHash: string;
  commercialWhy: string;
}

function prepareSignal(
  adapter: SignalSourceAdapter,
  signal: NormalisedSignal,
): PreparedSignal | null {
  const title = signal.title.trim();
  const sourceUrl = validHttpUrl(signal.sourceUrl);
  if (!title || !sourceUrl) return null;

  const sector = SIGNAL_SECTORS.includes(signal.sector)
    ? signal.sector
    : "PUBLIC_SECTOR";
  const opportunityType = SIGNAL_OPPORTUNITY_TYPES.includes(
    signal.opportunityType,
  )
    ? signal.opportunityType
    : "PROCUREMENT";
  const estimatedValue =
    typeof signal.estimatedValue === "number" &&
    Number.isFinite(signal.estimatedValue) &&
    signal.estimatedValue >= 0
      ? signal.estimatedValue
      : null;

  return {
    title: title.slice(0, 1000),
    buyerName:
      signal.buyerName.trim().slice(0, 255) || "Undisclosed buyer",
    jurisdiction: adapter.jurisdiction,
    sector,
    opportunityType,
    estimatedValue,
    sourceName: signal.sourceName.trim().slice(0, 255) || adapter.name,
    sourceUrl,
    sourceHash: buildSourceHash(adapter, signal),
    commercialWhy: singleSentence(signal.commercialWhy),
  };
}

async function startRun(adapter: SignalSourceAdapter): Promise<string | null> {
  try {
    const result = await query(
      `INSERT INTO ingestion_runs (status, payload, executed_at)
       VALUES ('running', $1::jsonb, NOW())
       RETURNING id`,
      [
        JSON.stringify({
          adapter: adapter.name,
          jurisdiction: adapter.jurisdiction,
          engine: "primary-source-signals",
        }),
      ],
    );
    return (result.rows[0] as { id?: string } | undefined)?.id ?? null;
  } catch (err) {
    warn("Could not record ingestion run start", {
      adapter: adapter.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function finishRun(
  runId: string | null,
  adapter: SignalSourceAdapter,
  status: string,
  discovered: number,
  inserted: number,
  failed: number,
  errorMessage?: string,
): Promise<void> {
  if (!runId) return;

  try {
    await query(
      `UPDATE ingestion_runs
          SET status = $2,
              records_processed = $3,
              signals_processed = $4,
              error_message = $5,
              completed_at = NOW()
        WHERE id = $1`,
      [runId, status, discovered, inserted, errorMessage ?? null],
    );

    if (errorMessage) {
      await query(
        `INSERT INTO ingestion_errors (run_id, error_message, error_details, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          runId,
          errorMessage,
          errorMessage,
          JSON.stringify({
            adapter: adapter.name,
            jurisdiction: adapter.jurisdiction,
            failed,
          }),
        ],
      );
    }
  } catch (err) {
    warn("Could not record ingestion run result", {
      adapter: adapter.name,
      runId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Runs a single adapter and persists its records. Returns counters rather than
 * throwing so one failing source never stops the rest of the cycle.
 */
export async function ingestAdapter(
  adapter: SignalSourceAdapter,
  options?: IngestionOptions,
): Promise<SignalIngestionResult> {
  const startedAt = Date.now();

  if (!adapter.enabled) {
    info("Skipping disabled ingestion adapter", { adapter: adapter.name });
    return {
      adapter: adapter.name,
      jurisdiction: adapter.jurisdiction,
      status: "skipped",
      discovered: 0,
      inserted: 0,
      duplicates: 0,
      failed: 0,
      durationMs: 0,
    };
  }

  let runId: string | null = null;
  let discovered = 0;
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;

  try {
    runId = await startRun(adapter);
    const records = await adapter.discover(options);
    discovered = records.length;

    for (const record of records) {
      const signal = prepareSignal(adapter, record);
      if (!signal) {
        failed++;
        continue;
      }

      try {
        const result = await query(
          `INSERT INTO signals (
             title, buyer_name, jurisdiction, sector, opportunity_type,
             estimated_value, source_name, source_url, source_hash, commercial_why
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (source_hash) DO NOTHING
           RETURNING id`,
          [
            signal.title,
            signal.buyerName,
            signal.jurisdiction,
            signal.sector,
            signal.opportunityType,
            signal.estimatedValue,
            signal.sourceName,
            signal.sourceUrl,
            signal.sourceHash,
            signal.commercialWhy,
          ],
        );

        if ((result.rowCount ?? 0) > 0) inserted++;
        else duplicates++;
      } catch (err) {
        failed++;
        error("Failed to persist signal", {
          adapter: adapter.name,
          sourceId: record.sourceId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const status = failed > 0 && inserted === 0 ? "partial" : "completed";
    await finishRun(runId, adapter, status, discovered, inserted, failed);

    info("Ingestion adapter complete", {
      adapter: adapter.name,
      jurisdiction: adapter.jurisdiction,
      discovered,
      inserted,
      duplicates,
      failed,
      durationMs: Date.now() - startedAt,
    });

    return {
      adapter: adapter.name,
      jurisdiction: adapter.jurisdiction,
      status: "completed",
      discovered,
      inserted,
      duplicates,
      failed,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(runId, adapter, "failed", discovered, inserted, failed, message);
    error("Ingestion adapter failed", {
      adapter: adapter.name,
      jurisdiction: adapter.jurisdiction,
      error: message,
    });

    return {
      adapter: adapter.name,
      jurisdiction: adapter.jurisdiction,
      status: "failed",
      discovered,
      inserted,
      duplicates,
      failed: failed + 1,
      durationMs: Date.now() - startedAt,
      error: message,
    };
  }
}

/** Runs every enabled adapter concurrently and returns aggregate counters. */
export async function runIngestionCycle(
  options?: RunIngestionOptions,
): Promise<IngestionCycleResult> {
  const startedAt = new Date().toISOString();
  const adapters = options?.adapters ?? SIGNAL_ADAPTERS;

  info("Starting primary-source ingestion cycle", {
    adapters: adapters.length,
  });

  const results = await Promise.all(
    adapters.map((adapter) => ingestAdapter(adapter, options)),
  );

  const summary: IngestionCycleResult = {
    startedAt,
    finishedAt: new Date().toISOString(),
    adapters: results,
    inserted: results.reduce((total, result) => total + result.inserted, 0),
    duplicates: results.reduce((total, result) => total + result.duplicates, 0),
    failed: results.reduce((total, result) => total + result.failed, 0),
  };

  info("Primary-source ingestion cycle complete", {
    inserted: summary.inserted,
    duplicates: summary.duplicates,
    failed: summary.failed,
    adapters: results.length,
  });

  return summary;
}

/**
 * Starts a long-running ingestion loop. Returns a stop function for graceful
 * shutdown. Calls never overlap: a slow cycle defers the next tick.
 */
export function startIngestionLoop(
  intervalMs: number = DEFAULT_INTERVAL_MS,
  options?: RunIngestionOptions,
): () => void {
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await runIngestionCycle(options);
    } catch (err) {
      error("Primary-source ingestion cycle crashed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
    }
  };

  info("Starting primary-source ingestion loop", { intervalMs });
  void tick();

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
    info("Stopped primary-source ingestion loop");
  };
}
