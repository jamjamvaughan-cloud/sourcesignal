/**
 * Helpers for mapping between the API's alert shape and the
 * `alerts.query_filters` JSONB column.
 *
 * The API exposes `{ sectors, regions, keywords, enabled }` (matching the
 * original PocketBase collection), while PostgreSQL stores criteria in a
 * single JSONB document and the active flag in `is_active`.
 */

import { isValidSectorId, isValidRegion } from "@/lib/config";

export interface AlertQueryFilters {
  sectors: string[];
  regions: string[];
  keywords: string;
}

/** Criteria used when an alert has no filters configured. */
export const EMPTY_ALERT_FILTERS: AlertQueryFilters = {
  sectors: [],
  regions: [],
  keywords: "",
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Parses the stored JSONB value into a well-formed filter object. */
export function parseAlertFilters(value: unknown): AlertQueryFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_ALERT_FILTERS };
  }
  const record = value as Record<string, unknown>;
  return {
    sectors: toStringArray(record.sectors),
    regions: toStringArray(record.regions),
    keywords: typeof record.keywords === "string" ? record.keywords : "",
  };
}

/**
 * Validates the user-supplied filter fields. Only keys present in the input
 * are returned, so callers can merge the result over existing filters for a
 * PATCH.
 */
export function validateAlertFilters(input: {
  sectors?: unknown;
  regions?: unknown;
  keywords?: unknown;
}):
  | { ok: true; filters: Partial<AlertQueryFilters> }
  | { ok: false; error: string } {
  const filters: Partial<AlertQueryFilters> = {};

  if (input.sectors !== undefined) {
    if (!Array.isArray(input.sectors)) {
      return { ok: false, error: "sectors must be an array." };
    }
    for (const sector of input.sectors) {
      if (typeof sector !== "string" || !isValidSectorId(sector)) {
        return { ok: false, error: `Invalid sector: ${String(sector)}` };
      }
    }
    filters.sectors = [...input.sectors];
  }

  if (input.regions !== undefined) {
    if (!Array.isArray(input.regions)) {
      return { ok: false, error: "regions must be an array." };
    }
    for (const region of input.regions) {
      if (typeof region !== "string" || !isValidRegion(region)) {
        return { ok: false, error: `Invalid region: ${String(region)}` };
      }
    }
    filters.regions = [...input.regions];
  }

  if (input.keywords !== undefined) {
    if (Array.isArray(input.keywords)) {
      filters.keywords = input.keywords
        .filter((item): item is string => typeof item === "string")
        .join(", ");
    } else if (typeof input.keywords === "string") {
      filters.keywords = input.keywords;
    } else {
      return { ok: false, error: "keywords must be a string." };
    }
  }

  return { ok: true, filters };
}

/** Returns true when an error is an invalid-UUID syntax error. */
export function isInvalidUuidError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "22P02"
  );
}
