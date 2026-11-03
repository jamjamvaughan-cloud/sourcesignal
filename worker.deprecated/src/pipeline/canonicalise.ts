/**
 * Canonicalisation and deduplication pipeline stage.
 *
 * Generates canonical IDs and detects duplicate records across re-ingestion
 * runs. Uses source name + source URL + source ID for the canonical ID, and
 * SHA-256 source hash for change detection.
 */

import { hashCanonicalId, hashSourceSnapshot } from "@/utils/hash";
import type { NormalisedOpportunity, SourceRecord } from "@/types";

/**
 * Canonicalises a normalised opportunity, generating its canonical ID and
 * source hash.
 */
export function canonicalise(
  opportunity: NormalisedOpportunity,
  record: SourceRecord,
): NormalisedOpportunity {
  return {
    ...opportunity,
    canonicalId: hashCanonicalId(
      record.sourceName,
      record.sourceUrl,
      record.sourceId,
    ),
    sourceHash: hashSourceSnapshot(record.sourceUrl, record.rawPayload),
  };
}

/**
 * Determines whether a normalised opportunity is a duplicate of an existing
 * record by comparing canonical IDs.
 */
export function isDuplicate(
  opportunity: NormalisedOpportunity,
  existingCanonicalIds: Set<string>,
): boolean {
  return existingCanonicalIds.has(opportunity.canonicalId);
}

/**
 * Determines whether a source snapshot has changed by comparing hashes.
 */
export function hasSourceChanged(
  opportunity: NormalisedOpportunity,
  existingSourceHash?: string,
): boolean {
  if (!opportunity.sourceHash) return true;
  if (!existingSourceHash) return true;
  return opportunity.sourceHash !== existingSourceHash;
}
