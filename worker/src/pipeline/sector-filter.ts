/**
 * Sector filtering pipeline stage.
 *
 * Implements strict ingestion-level sector enforcement. Only tenders that
 * explicitly map to our core commercial sectors (Infrastructure, Energy,
 * Defence, Technology, Logistics) are ingested. All other public sector
 * noise (administrative, stationery, catering, education, health, etc.)
 * is dropped before reaching the database.
 *
 * Filtering uses CPV codes when available, falling back to keyword matching
 * on title, summary, buyer, and sector fields.
 */

import type { SourceRecord } from "@/types";
import {
  determineSector,
  type CoreSectorId,
} from "@/lib/cpv-sector-mapping";

/**
 * Filters a source record against the core sector allowlist.
 *
 * Returns the record with a resolved sector if it passes filtering,
 * or null if the record should be dropped (non-ingestible sector).
 */
export function filterBySector(record: SourceRecord): SourceRecord | null {
  const sector = determineSector(record);
  if (!sector) return null;

  // Update the record's sector to the resolved core sector
  const payload = { ...record.rawPayload };
  payload.sector = sector;

  return {
    ...record,
    rawPayload: payload,
  };
}

export type { CoreSectorId };
