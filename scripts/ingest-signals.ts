#!/usr/bin/env tsx
/**
 * Primary-source ingestion CLI.
 *
 * Usage:
 *   npx tsx scripts/ingest-signals.ts --once    # single cycle, then exit
 *   npx tsx scripts/ingest-signals.ts --watch   # long-running 15-min loop
 */

import "./load-env";
import { closePool } from "../src/lib/db";
import {
  runIngestionCycle,
  startIngestionLoop,
} from "../src/lib/ingestion/runner";

const watch = process.argv.includes("--watch");

async function runOnce(): Promise<void> {
  const result = await runIngestionCycle();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await closePool();
  process.exit(result.failed > 0 ? 1 : 0);
}

function runWatch(): void {
  const stop = startIngestionLoop();

  const shutdown = async () => {
    stop();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (watch) {
  runWatch();
} else {
  runOnce().catch(async (err) => {
    console.error(
      "❌ Primary-source ingestion failed:",
      err instanceof Error ? err.message : String(err),
    );
    await closePool();
    process.exit(1);
  });
}
