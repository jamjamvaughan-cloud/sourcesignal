/**
 * Upsert pipeline stage.
 *
 * Writes normalised, canonicalised opportunities into PocketBase
 * idempotently. Uses the PocketBase admin client (server-side only).
 *
 * Every ingested record carries an immutable SHA-256 source hash (provenance)
 * and CPV code for zero-hallucination source traceability.
 */

import PocketBase from "pocketbase";
import type { NormalisedOpportunity } from "@/types";

/**
 * Upserts a single opportunity into PocketBase.
 * Uses canonical_id as the unique key for idempotent updates.
 *
 * Provenance: source_hash (SHA-256 of source snapshot) is stored on every
 * record. CPV code is preserved in detail_fields for traceability.
 */
export async function upsertOpportunity(
  pb: PocketBase,
  opportunity: NormalisedOpportunity,
): Promise<{ inserted: boolean; updated: boolean }> {
  const detailFields = {
    ...(opportunity.detailFields ?? {}),
    ...(opportunity.cpvCode ? { cpv_code: opportunity.cpvCode } : {}),
  };

  const data: Record<string, unknown> = {
    canonical_id: opportunity.canonicalId,
    title: opportunity.title,
    summary: opportunity.summary ?? null,
    buyer: opportunity.buyer ?? null,
    sector: opportunity.sector,
    region: opportunity.region,
    location: opportunity.location ?? null,
    latitude: opportunity.latitude ?? null,
    longitude: opportunity.longitude ?? null,
    published_date: opportunity.publishedDate ?? null,
    closing_date: opportunity.closingDate ?? null,
    estimated_value: opportunity.estimatedValue ?? null,
    currency: opportunity.currency ?? null,
    procurement_stage: opportunity.procurementStage ?? null,
    source_url: opportunity.sourceUrl ?? null,
    source_hash: opportunity.sourceHash ?? null,
    confidence: opportunity.confidence ?? null,
    detail_fields: detailFields,
    estimated_expiry_date: opportunity.estimatedExpiryDate ?? null,
    winner: opportunity.winningBidder ?? null,
    signal_tier: opportunity.signalTier ?? null,
    is_demonstration: opportunity.sourceUrl.includes("demo.sourcesignal.example"),
  };

  // Try to find existing record by canonical_id.
  const existing = await pb
    .collection("opportunities")
    .getFirstListItem(`canonical_id = "${opportunity.canonicalId}"`);

  if (existing) {
    // Only update if source hash changed (record was modified).
    if (existing.source_hash !== opportunity.sourceHash) {
      await pb.collection("opportunities").update(existing.id, data);
      return { inserted: false, updated: true };
    }
    return { inserted: false, updated: false };
  }

  await pb.collection("opportunities").create(data);
  return { inserted: true, updated: false };
}
