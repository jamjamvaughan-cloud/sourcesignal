#!/usr/bin/env tsx
/**
 * 1-Year Historical Signal Backfill.
 *
 * Iterates the trailing 365-day window in 30-day chunks across the six active
 * (free) primary-source adapters and persists every normalised signal through
 * the existing SHA-256 deduplication path (`ON CONFLICT (source_hash) DO
 * NOTHING`), so the script is safe to re-run.
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
import { info } from "../src/lib/logger";
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

async function runBackfill(): Promise<void> {
  const until = new Date();
  const since = new Date(until.getTime() - HORIZON_DAYS * DAY_MS);
  const chunks = chunkWindow(since, until);

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

    for (const chunk of chunks) {
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

function sleepOrDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runBackfill().catch(async (err) => {
  console.error(
    "❌ Backfill failed:",
    err instanceof Error ? err.message : String(err),
  );
  await closePool();
  process.exit(1);
});
