/**
 * SHA-256 utilities for source provenance.
 *
 * SHA-256 proves that particular bytes match a hash; it does not independently
 * prove that a source is authentic or that an extracted claim is true. Enough
 * source metadata must be preserved to explain the chain of evidence.
 */

import { createHash } from "crypto";

/**
 * Computes the SHA-256 hash of a UTF-8 string.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Computes the SHA-256 hash of a Buffer.
 */
export function sha256Buffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Computes a canonical hash for a source snapshot, combining the source URL
 * and the raw payload. This hash is stored alongside the snapshot so that
 * future fetches of the same URL can detect changes.
 */
export function hashSourceSnapshot(
  sourceUrl: string,
  rawPayload: Record<string, unknown>,
): string {
  const canonical = JSON.stringify({
    url: sourceUrl,
    payload: rawPayload,
  });
  return sha256(canonical);
}

/**
 * Computes a canonical identifier for an opportunity, based on source name,
 * source URL, and source-specific record ID. This supports deduplication
 * across re-ingestion runs.
 */
export function hashCanonicalId(
  sourceName: string,
  sourceUrl: string,
  sourceId: string,
): string {
  return sha256(`${sourceName}|${sourceUrl}|${sourceId}`);
}
