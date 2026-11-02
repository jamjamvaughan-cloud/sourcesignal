/**
 * Normalisation pipeline stage.
 *
 * Converts raw source records into the common NormalisedOpportunity schema.
 * Sector and region values are validated against the central configuration.
 *
 * Sector filtering is applied here: only records matching our core commercial
 * sectors (Infrastructure & Construction, Energy & Utilities, Technology &
 * Telecom, Defence Aerospace & Industrial, Logistics & Healthcare Capex) pass
 * through. All other public sector noise is dropped before reaching the DB.
 *
 * CPV codes are extracted from the raw payload when available for provenance
 * and sector classification.
 */

import type { NormalisedOpportunity, SourceRecord } from "@/types";
import { geocodeOpportunity } from "./geocode";
import {
  determineSector,
  extractSectorText,
} from "@/lib/cpv-sector-mapping";
import { resolveBuyer } from "@/lib/normalise-buyer";

/**
 * Valid region codes per country/jurisdiction. Used to enforce country-based
 * isolation: a UK adapter must never produce US-region records, a US adapter
 * must never produce AU-region records, and so on.
 */
const COUNTRY_REGIONS: Record<string, string[]> = {
  UK: ["ENG", "SCT", "WLS", "NIR"],
  US: ["US"],
  CA: ["CA"],
  IE: ["IE"],
  AU: ["AU"],
  EU: ["EU"],
};

/**
 * Returns the primary (default) region for a given country.
 */
function primaryRegionForCountry(country: string): string {
  return COUNTRY_REGIONS[country]?.[0] ?? "";
}

/**
 * Validates that a region belongs to the record's country.
 * If the region is missing or invalid for the country, it is corrected to
 * the country's primary region. If the country is unknown, the region is
 * left as-is.
 */
function validateRegionForCountry(
  country: string | undefined,
  region: string,
): string {
  if (!country) return region;
  const validRegions = COUNTRY_REGIONS[country];
  if (!validRegions) return region;
  if (validRegions.includes(region)) return region;
  // Region doesn't belong to this country — correct to primary region.
  return primaryRegionForCountry(country);
}

/**
 * Normalises a source record into the common schema.
 * Returns null if the record cannot be normalised (missing required fields)
 * or if the sector does not match our core commercial sectors.
 *
 * When latitude/longitude are not present in the raw payload, a geocoding
 * fallback maps regional dockets (cities, states, provinces) to approximate
 * coordinates so the Pro 3D interactive globe map can render pins.
 */
export function normaliseRecord(
  record: SourceRecord,
): NormalisedOpportunity | null {
  const payload = record.rawPayload as Record<string, unknown>;

  const title = (payload.title as string) || record.sourceId;
  if (!title) return null;

  const sector = (payload.sector as string) || "";
  const region = (payload.region as string) || "";

  // Normalise sector: try exact match first, then case-insensitive.
  const normalisedSector = sector;
  // Normalise region: uppercase, then enforce country-based isolation.
  const normalisedRegion = validateRegionForCountry(
    record.country,
    region.toUpperCase(),
  );

  const location = (payload.location as string) || undefined;
  const buyer = (payload.buyer as string) || undefined;
  const summary = (payload.summary as string) || undefined;

  // Resolve buyer to canonical entity ID for cross-source analysis.
  const buyerCanonical = resolveBuyer(buyer);
  const buyerCanonicalId = buyerCanonical?.buyerCanonicalId ?? undefined;

  // Latitude/longitude: prefer payload values, fall back to geocoding.
  let latitude = payload.latitude ? Number(payload.latitude) : undefined;
  let longitude = payload.longitude ? Number(payload.longitude) : undefined;

  if ((latitude === undefined || longitude === undefined) && location) {
    const geo = geocodeOpportunity({
      location,
      region: normalisedRegion,
      buyer,
      title,
      summary,
    });
    if (geo) {
      if (latitude === undefined) latitude = geo.lat;
      if (longitude === undefined) longitude = geo.lon;
    }
  }

  // Extract CPV code from payload for provenance and sector classification
  const cpvCode =
    payload.cpv ??
    payload.cpv_code ??
    payload.main_cpv ??
    payload.additional_cpv ??
    (payload.tender as Record<string, unknown>)?.cpv ??
    undefined;

  // Strict sector filtering: only core commercial sectors are ingested
  const resolvedSector = determineSector(record);
  if (!resolvedSector) {
    // Sector does not match our core allowlist — drop the record
    return null;
  }

  return {
    canonicalId: "", // set during canonicalisation
    title: String(title),
    summary,
    buyer,
    buyerCanonicalId,
    sector: resolvedSector,
    region: normalisedRegion,
    location,
    latitude,
    longitude,
    publishedDate: (payload.publishedDate as string) || undefined,
    closingDate: (payload.closingDate as string) || undefined,
    estimatedValue: payload.estimatedValue
      ? Number(payload.estimatedValue)
      : undefined,
    currency: (payload.currency as string) || undefined,
    procurementStage: (payload.procurementStage as string) || undefined,
    sourceUrl: record.sourceUrl,
    sourceHash: undefined, // set during provenance
    confidence: payload.confidence ? Number(payload.confidence) : undefined,
    detailFields: payload.detailFields
      ? (payload.detailFields as Record<string, unknown>)
      : undefined,
    // Store CPV code as string for provenance traceability
    cpvCode: typeof cpvCode === "string" ? cpvCode : undefined,
  };
}
