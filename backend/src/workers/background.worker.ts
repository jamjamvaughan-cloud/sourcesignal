/**
 * SourceSignal — Dedicated background worker (BullMQ processor).
 *
 * Isolates heavy async work out of the API: outbound webhook delivery with
 * HMAC-SHA256 signatures, signal ingestion/hashing, and any future crypto or
 * ingestion tasks. Runs as its own container/replica so API instances stay
 * stateless and lightweight.
 *
 * Also runs a periodic ingestion cron loop (every 15 minutes) that executes
 * all active ingestion adapters and persists signals via PgBouncer to
 * PostgreSQL, deduplicated by SHA-256 content hash.
 */

import { Worker, Queue, type Job } from "bullmq";
import { redis, closeConnections, query } from "../config/database";
import { computeContentHash } from "../modules/signals/routes";
import {
  signPayload,
  buildSignalPayload,
  webhookQueue,
  WEBHOOK_QUEUE_NAME,
} from "../modules/webhooks/routes";
import {
  SIGNAL_ADAPTERS,
  getEnabledSignalAdapters,
  IngestionOptions,
  SignalIngestionResult,
} from "../adapters";

/* ------------------------------------------------------------------ */
/* Queues                                                             */
/* ------------------------------------------------------------------ */

const INGESTION_QUEUE_NAME = "signal-ingest";
const CONTENT_HASH_QUEUE_NAME = "content-hash";

const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, { connection: redis });
const contentHashQueue = new Queue(CONTENT_HASH_QUEUE_NAME, { connection: redis });

/* ------------------------------------------------------------------ */
/* Ingestion cron loop (15-minute interval)                           */
/* ------------------------------------------------------------------ */

const INGESTION_INTERVAL_MS = 15 * 60 * 1000;

let ingestionLoopInterval: ReturnType<typeof setInterval> | null = null;
let ingestionRunning = false;

/**
 * Runs a single ingestion cycle across all enabled adapters, computing
 * SHA-256 content hashes and upserting signals into PostgreSQL via PgBouncer
 * with ON CONFLICT (content_hash) DO NOTHING for idempotent re-ingestion.
 */
async function runIngestionCycle(options?: IngestionOptions): Promise<void> {
  const adapters = getEnabledSignalAdapters();
  console.log("[ingestion] Starting cycle", { adapters: adapters.length });

  let discovered = 0;
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;

  for (const adapter of adapters) {
    if (!adapter.enabled) continue;

    const startedAt = Date.now();
    let adapterDiscovered = 0;

    try {
      const records = await adapter.discover(options);
      adapterDiscovered = records.length;
      discovered += adapterDiscovered;

      for (const record of records) {
        const contentHash = computeContentHash(record.rawPayload ?? null);

        try {
          const result = await query(
            `INSERT INTO signals (
              organisation_id, title, source_url, content_hash, sha256_hash,
              raw_payload, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id`,
            [
              null, // system ingestion — no organisation
              record.title,
              record.sourceUrl,
              contentHash,
              contentHash,
              JSON.stringify(record.rawPayload ?? null),
            ],
          );

          if ((result.rowCount ?? 0) > 0) {
            inserted++;
          } else {
            duplicates++;
          }
        } catch (err) {
          failed++;
          console.warn("[ingestion] Signal insert failed", {
            adapter: adapter.name,
            sourceId: record.sourceId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      console.log("[ingestion] Adapter complete", {
        adapter: adapter.name,
        jurisdiction: adapter.jurisdiction,
        discovered: adapterDiscovered,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      failed++;
      console.error("[ingestion] Adapter error", {
        adapter: adapter.name,
        jurisdiction: adapter.jurisdiction,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("[ingestion] Cycle complete", { discovered, inserted, duplicates, failed });
}

/**
 * Starts the ingestion cron loop. Runs immediately on startup, then every
 * INGESTION_INTERVAL_MS (15 minutes). Returns a stop function.
 */
export function startIngestionLoop(options?: IngestionOptions): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped || ingestionRunning) return;
    ingestionRunning = true;
    try {
      await runIngestionCycle(options);
    } catch (err) {
      console.error("[ingestion] Cycle crashed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      ingestionRunning = false;
    }
  };

  console.log("[ingestion] Starting ingestion loop", { intervalMs: INGESTION_INTERVAL_MS });
  void tick();

  ingestionLoopInterval = setInterval(() => {
    void tick();
  }, INGESTION_INTERVAL_MS);

  return () => {
    stopped = true;
    if (ingestionLoopInterval) {
      clearInterval(ingestionLoopInterval);
      ingestionLoopInterval = null;
    }
    console.log("[ingestion] Loop stopped");
  };
}

/* ------------------------------------------------------------------ */
/* Job processors                                                     */
/* ------------------------------------------------------------------ */

/**
 * Delivers a signed webhook payload to a target URL with retries.
 * Handles HTTP 5xx / network errors via BullMQ's built-in backoff.
 */
async function processWebhookDelivery(job: Job) {
  const { url, secret, payload, signature, signal_id, attempts_left } =
    job.data as {
      url: string;
      secret?: string;
      payload: unknown;
      signature?: string;
      signal_id?: string;
      attempts_left: number;
    };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SourceSignal/1.0 (+https://sourcesignal.site)",
    "X-SourceSignal-Event": "signal.created",
    "X-SourceSignal-Signal-Id": String(signal_id ?? ""),
  };

  if (secret && signature) {
    headers["X-SourceSignal-Signature"] = signature;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let lastError: string | null = null;
  let statusCode: number | null = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    statusCode = response.status;

    if (response.ok) {
      console.log("[worker] webhook delivered", {
        jobId: job.id,
        url,
        status: response.status,
        signal_id,
      });
      return { status: "sent", statusCode: response.status };
    }

    // Retryable server errors → throw so BullMQ retries with backoff.
    if (statusCode >= 500) {
      lastError = `HTTP ${statusCode}`;
      throw new Error(lastError);
    }

    // Client errors (4xx) are not retryable — mark as failed without throwing.
    console.warn("[worker] webhook client error", {
      jobId: job.id,
      url,
      status: response.status,
      signal_id,
    });
    return { status: "failed", statusCode: response.status };
  } catch (err) {
    lastError =
      err instanceof Error ? err.message : String(err);
    console.warn("[worker] webhook delivery error", {
      jobId: job.id,
      url,
      error: lastError,
      signal_id,
      attempt: job.attemptsMade + 1,
    });

    // Exhausted retries → do not rethrow; record final failure.
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 5)) {
      return { status: "failed", statusCode, error: lastError };
    }

    throw err; // let BullMQ handle the backoff/retry
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Signal ingestion job: validates and stores a signal, computing its
 * content_hash for deduplication.
 */
async function processSignalIngestion(job: Job) {
  const {
    organisation_id,
    title,
    source_url,
    raw_payload,
  } = job.data as {
    organisation_id: string;
    title: string;
    source_url?: string;
    raw_payload: unknown;
  };

  const contentHash = computeContentHash(raw_payload);

  const result = await query(
    `INSERT INTO signals (
      organisation_id, title, source_url, content_hash, raw_payload, created_at
     ) VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, organisation_id, title, source_url, content_hash, raw_payload, created_at`,
    [organisation_id, title, source_url ?? null, contentHash, raw_payload],
  );

  const signal = result.rows[0];
  console.log("[worker] signal ingested", {
    jobId: job.id,
    signal_id: signal.id,
    organisation_id,
    content_hash: contentHash,
  });

  return { signal_id: signal.id, content_hash: contentHash };
}

/**
 * Content-hash job: computes SHA-256 over a JSON payload (standalone hashing
 * task, kept separate per the crypto-hashing isolation requirement).
 */
async function processContentHash(job: Job) {
  const { payload } = job.data as { payload: unknown };
  const hash = computeContentHash(payload);
  console.log("[worker] content hash computed", { jobId: job.id, hash });
  return { content_hash: hash };
}

/* ------------------------------------------------------------------ */
/* Worker setup                                                       */
/* ------------------------------------------------------------------ */

const worker = new Worker(
  WEBHOOK_QUEUE_NAME,
  processWebhookDelivery,
  {
    connection: redis,
    concurrency: 10,
    // Stalled jobs are reclaimed after this interval (ms).
    stalledInterval: 30_000,
    maxStalledCount: 3,
  },
);

const ingestionWorker = new Worker(
  INGESTION_QUEUE_NAME,
  processSignalIngestion,
  { connection: redis, concurrency: 5 },
);

const contentHashWorker = new Worker(
  CONTENT_HASH_QUEUE_NAME,
  processContentHash,
  { connection: redis, concurrency: 5 },
);

/* ------------------------------------------------------------------ */
/* Event logging                                                      */
/* ------------------------------------------------------------------ */

function logWorkerEvents(workerInstance: Worker, name: string) {
  workerInstance.on("completed", (job) => {
    console.log(`[worker:${name}] completed`, { jobId: job.id });
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[worker:${name}] failed`, {
      jobId: job?.id,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
  });
  workerInstance.on("error", (err) => {
    console.error(`[worker:${name}] worker error`, {
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
  });
}

logWorkerEvents(worker, WEBHOOK_QUEUE_NAME);
logWorkerEvents(ingestionWorker, INGESTION_QUEUE_NAME);
logWorkerEvents(contentHashWorker, CONTENT_HASH_QUEUE_NAME);

/* ------------------------------------------------------------------ */
/* Graceful shutdown                                                  */
/* ------------------------------------------------------------------ */

async function shutdown() {
  console.log("[worker] Shutting down...");
  await Promise.all([
    worker.close(),
    ingestionWorker.close(),
    contentHashWorker.close(),
    webhookQueue.close(),
    ingestionQueue.close(),
    contentHashQueue.close(),
    closeConnections(),
  ]);
  if (ingestionLoopInterval) {
    clearInterval(ingestionLoopInterval);
  }
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Unhandled rejection safety net (prevents silent worker crashes).
process.on("unhandledRejection", (err) => {
  console.error("[worker] Unhandled rejection", {
    error: err instanceof Error ? err.stack ?? err.message : String(err),
  });
});

console.log("[worker] Background worker started", {
  queues: [WEBHOOK_QUEUE_NAME, INGESTION_QUEUE_NAME, CONTENT_HASH_QUEUE_NAME],
});

// Start the ingestion cron loop immediately on worker startup.
startIngestionLoop();
