/**
 * SourceSignal — Dedicated background worker (BullMQ processor).
 *
 * Isolates heavy async work out of the API: outbound webhook delivery with
 * HMAC-SHA256 signatures, signal ingestion/hashing, and any future crypto or
 * ingestion tasks. Runs as its own container/replica so API instances stay
 * stateless and lightweight.
 */
export {};
//# sourceMappingURL=background.worker.d.ts.map