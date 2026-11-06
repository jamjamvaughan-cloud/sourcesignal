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
import { IngestionOptions } from "../adapters";
/**
 * Starts the ingestion cron loop. Runs immediately on startup, then every
 * INGESTION_INTERVAL_MS (15 minutes). Returns a stop function.
 */
export declare function startIngestionLoop(options?: IngestionOptions): () => void;
//# sourceMappingURL=background.worker.d.ts.map