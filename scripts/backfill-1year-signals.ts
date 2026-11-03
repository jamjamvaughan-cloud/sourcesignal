#!/usr/bin/env tsx
/**
 * 1-Year Historical Signal Backfill.
 *
 * Iterates the trailing 365-day window in 30-day chunks across the six active
 * (free) primary-source adapters and persists every normalised signal through
 * the existing SHA-256 deduplication path (`ON CONFLICT (source_hash) DO
 * NOTHING`), so the script is safe to re-run.
 *
 * Checkpointing: progress is persisted to the `backfill_checkpoints` table
 * after each chunk, so interrupted backfills can resume from the last
 * completed chunk without re-processing already-ingested data.
 *
 * Each adapter receives a `since`/`until` date window and paginates internally
 * with a 500ms delay between pages and exponential backoff on HTTP 429/503.
 * The source's own `published_at` timestamp is preserved rather than using the
 * ingestion execution time.
 *
 * Usage:
 *   npx tsx scripts/backfill-1year-signals.ts
 */

import "./load-env";
import { closePool } from "../src/lib/db";
import { query } from "../src/lib/db";
import { info, warn } from "../src/lib/logger";
import { ingestAdapter } from "../src/lib/ingestion/runner";
import type { SignalSourceAdapter } from "../src/lib/ingestion/adapters";
import ukTenders from "../src/lib/ingestion/uk-tenders";
import ukPlanning from "../src/lib/ingestion/uk-planning";
import usSpending from "../src/lib/ingestion/us-spending";
import usSec from "../src/lib/ingestion/us-sec";
import euTedSparql from "../src/lib/ingestion/eu-ted-sparql";
import euOpenData from "../src/lib/ingestion/eu-opendata";

const DAY_MS = 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 365;
const CHUNK_DAYS = 30;
const PAGE_DELAY_MS = 500;

/** Per-adapter page caps per 30-day chunk to keep each chunk bounded. */
const MAX_PAGES_PER_CHUNK: Record<string, number> = {
  "uk-tenders": 20,
  "uk-planning": 50,
  "us-spending": 20,
  "us-sec": 1,
  "eu-ted-sparql": 20,
  "eu-opendata": 20,
};

const LIMIT = 100;

/** The six active (free) primary-source adapters. */
const ACTIVE_ADAPTERS: SignalSourceAdapter[] = [
  ukTenders,
  ukPlanning,
  usSpending,
  usSec,
  euTedSparql,
  euOpenData,
];

interface Checkpoint {
  adapter_name: string;
  last_completed_window_start: Date;
  last_completed_window_end: Date;
  total_inserted: number;
  total_duplicates: number;
  total_failed: number;
}

/** Splits [since, until] into inclusive 30-day chunks (most recent first). */
function chunkWindow(since: Date, until: Date): Array<{ since: Date; until: Date }> {
  const chunks: Array<{ since: Date; until: Date }> = [];
  let cursor = new Date(until);
  while (cursor > since) {
    const chunkStart = new Date(
      Math.max(since.getTime(), cursor.getTime() - CHUNK_DAYS * DAY_MS),
    );
    chunks.push({ since: chunkStart, until: new Date(cursor) });
    cursor = chunkStart;
  }
  return chunks;
}

/** Load checkpoints from the database, keyed by adapter name. */
async function loadCheckpoints(): Promise<Map<string, Checkpoint>> {
  const result = await query(
    `SELECT adapter_name, last_completed_window_start, last_completed_window_end,
            total_inserted, total_duplicates, total_failed
       FROM backfill_checkpoints`,
  );
  const map = new Map<string, Checkpoint>();
  for (const row of result.rows ?? []) {
    map.set(row.adapter_name as string, {
      adapter_name: row.adapter_name as string,
      last_completed_window_start: row.last_completed_window_start as Date,
      last_completed_window_end: row.last_completed_window_end as Date,
      total_inserted: Number(row.total_inserted ?? 0),
      total_duplicates: Number(row.total_duplicates ?? 0),
      total_failed: Number(row.total_failed ?? 0),
    });
  }
  return map;
}

/** Save or update a checkpoint for an adapter. */
async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await query(
    `INSERT INTO backfill_checkpoints (
            adapter_name, last_completed_window_start, last_completed_window_end,
            total_inserted, total_duplicates, total_failed, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (adapter_name)
       DO UPDATE SET
            last_completed_window_start = EXCLUDED.last_completed_window_start,
            last_completed_window_end = EXCLUDED.last_completed_window_end,
            total_inserted = EXCLUDED.total_inserted,
            total_duplicates = EXCLUDED.total_duplicates,
            total_failed = EXCLUDED.total_failed,
            updated_at = NOW()`,
    [
      checkpoint.adapter_name,
      checkpoint.last_completed_window_start,
      checkpoint.last_completed_window_end,
      checkpoint.total_inserted,
      checkpoint.total_duplicates,
      checkpoint.total_failed,
    ],
  );
}

function sleepOrDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBackfill(): Promise<void> {
  const until = new Date();
  const since = new Date(until.getTime() - HORIZON_DAYS * DAY_MS);
  const chunks = chunkWindow(since, until);
  const checkpoints = await loadCheckpoints();

  info("Starting 1-year signal backfill", {
    since: since.toISOString(),
    until: until.toISOString(),
    chunks: chunks.length,
    adapters: ACTIVE_ADAPTERS.length,
  });

  const totals: Record<string, { inserted: number; duplicates: number; failed: number }> = {};

  for (const adapter of ACTIVE_ADAPTERS) {
    if (!adapter.enabled) continue;
    totals[adapter.name] = { inserted: 0, duplicates: 0, failed: 0 };

    const checkpoint = checkpoints.get(adapter.name);
    let skipUntil: Date | null = null;
    if (checkpoint) {
      totals[adapter.name] = {
        inserted: checkpoint.total_inserted,
        duplicates: checkpoint.total_duplicates,
        failed: checkpoint.total_failed,
      };
      skipUntil = checkpoint.last_completed_window_end;
      info("Resuming backfill from checkpoint", {
        adapter: adapter.name,
        lastCompletedWindowEnd: checkpoint.last_completed_window_end,
      });
    }

    for (const chunk of chunks) {
      // Skip chunks already completed (checkpoint marks end of last done chunk).
      if (skipUntil && chunk.until <= skipUntil) continue;

      const options = {
        since: chunk.since,
        until: chunk.until,
        limit: LIMIT,
        maxPages: MAX_PAGES_PER_CHUNK[adapter.name] ?? 10,
      };

      const result = await ingestAdapter(adapter, options);

      totals[adapter.name].inserted += result.inserted;
      totals[adapter.name].duplicates += result.duplicates;
      totals[adapter.name].failed += result.failed;

      info("Backfill chunk complete", {
        adapter: adapter.name,
        jurisdiction: adapter.jurisdiction,
        since: chunk.since.toISOString().slice(0, 10),
        until: chunk.until.toISOString().slice(0, 10),
        inserted: result.inserted,
        duplicates: result.duplicates,
        failed: result.failed,
        durationMs: result.durationMs,
      });

      // Save checkpoint after each chunk.
      await saveCheckpoint({
        adapter_name: adapter.name,
        last_completed_window_start: chunk.since,
        last_completed_window_end: chunk.until,
        total_inserted: totals[adapter.name].inserted,
        total_duplicates: totals[adapter.name].duplicates,
        total_failed: totals[adapter.name].failed,
      });

      // Polite gap between chunk/adapter requests.
      await sleepOrDelay(PAGE_DELAY_MS);
    }
  }

  info("1-year signal backfill complete", { totals });

  let grandInserted = 0;
  for (const adapter of ACTIVE_ADAPTERS) {
    if (!adapter.enabled) continue;
    const t = totals[adapter.name];
    grandInserted += t.inserted;
    info(`${adapter.name.padEnd(16)} inserted=${t.inserted} duplicates=${t.duplicates} failed=${t.failed}`, {
      adapter: adapter.name,
    });
  }
  info(`Grand total inserted=${grandInserted}`);

  await closePool();
  process.exit(grandInserted > 0 ? 0 : 0);
}

runBackfill().catch(async (err) => {
  console.error(
    "❌ Backfill failed:",
    err instanceof Error ? err.message : String(err),
  );
  await closePool();
  process.exit(1);
});
