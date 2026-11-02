/**
 * Server-side opportunity service.
 *
 * All opportunity reads/writes go through this boundary. It uses the
 * PostgreSQL admin client (server-side only) and applies entitlement-based field
 * sanitization before returning data to the client.
 */

import { query } from "@/lib/db";
import {
  entitlementsFor,
  sanitizeOpportunity,
  type Entitlements,
} from "@/lib/entitlements";
import { isValidSectorId, isValidRegion } from "@/lib/config";
import { createHash } from "crypto";

export interface OpportunityFilters {
  sector?: string;
  region?: string;
  country?: string;
  q?: string;
  stage?: string;
  page?: number;
  perPage?: number;
  sort?: string;
}

export interface OpportunityListResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 25;

const COUNTRY_REGIONS: Record<string, string[]> = {
  UK: ["ENG", "SCT", "WLS", "NIR"],
  US: ["US"],
  CA: ["CA"],
  IE: ["IE"],
  AU: ["AU"],
  EU: ["EU"],
};

const VALID_STAGES = [
  "planned",
  "published",
  "evaluation",
  "awarded",
  "cancelled",
  "expired",
];

function escapeSqlFilter(value: string): string {
  return value.replace(/'/g, "''");
}

export async function listOpportunities(
  entitlements: Entitlements,
  filters: OpportunityFilters = {},
): Promise<OpportunityListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, filters.perPage ?? DEFAULT_PER_PAGE),
  );

  const filterParts: string[] = [];

  // Only non-demonstration records are live intelligence; demonstration
  // records are clearly marked and excluded from default browsing.
  filterParts.push("is_demonstration = false");

  if (filters.sector && isValidSectorId(filters.sector)) {
    filterParts.push(`sector = '${escapeSqlFilter(filters.sector)}'`);
  }

  // Country-based isolation: resolve country to its regions and filter.
  // This ensures UK users only see UK signals, US users only see US signals,
  // etc.
  if (filters.country && COUNTRY_REGIONS[filters.country]) {
    const regions = COUNTRY_REGIONS[filters.country];
    const regionFilter = regions
      .map((r) => `region = '${r}'`)
      .join(" OR ");
    filterParts.push(`(${regionFilter})`);
  } else if (filters.region && isValidRegion(filters.region)) {
    filterParts.push(`region = '${escapeSqlFilter(filters.region)}'`);
  }
  if (filters.stage && VALID_STAGES.includes(filters.stage)) {
    filterParts.push(`procurement_stage = '${filters.stage}'`);
  }
  if (filters.q) {
    const escapedQ = escapeSqlFilter(filters.q);
    filterParts.push(
      `(title ILIKE '%${escapedQ}%' OR summary ILIKE '%${escapedQ}%' OR buyer ILIKE '%${escapedQ}%')`,
    );
  }

  const filter = filterParts.length > 0 ? filterParts.join(" AND ") : "";

  const sort =
    filters.sort === "published_date"
      ? "published_date DESC"
    : filters.sort === "closing_date"
      ? "-closing_date"
    : filters.sort === "value"
      ? "-estimated_value"
      : "-created_at";

  const orderBy =
    sort.startsWith("-") ? sort.slice(1) + " DESC" : sort + " ASC";

  const offset = (page - 1) * perPage;

  const result = await query(
    `SELECT id, canonical_id, title, sector, region, location, buyer,
            estimated_value, currency, procurement_stage, published_date,
            closing_date, confidence, signal_tier, source_url, summary,
            is_demonstration, created_at, updated_at, source_hash
     FROM opportunities
     ${filter ? `WHERE ${filter}` : ""}
     ORDER BY ${orderBy}
     LIMIT $1 OFFSET $2`,
    [perPage, offset],
  );

  const items = result.rows.map((item) =>
    sanitizeOpportunity(item, entitlements),
  );

  return {
    items,
    total: result.rows.length,
    page,
    perPage,
    totalPages: Math.ceil(result.rows.length / perPage),
  };
}

export async function getOpportunity(
  id: string,
  entitlements: Entitlements,
): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT id, canonical_id, title, sector, region, location, buyer,
            estimated_value, currency, procurement_stage, published_date,
            closing_date, confidence, signal_tier, source_url, summary,
            is_demonstration, created_at, updated_at, source_hash
     FROM opportunities WHERE id = $1`,
    [id],
  );

  if (result.rowCount === 0) return null;
  return sanitizeOpportunity(result.rows[0], entitlements);
}

export async function createDemonstrationOpportunity(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await query(
    `INSERT INTO opportunities (
      canonical_id, title, sector, region, location, buyer, estimated_value,
      currency, procurement_stage, published_date, closing_date, confidence,
      signal_tier, source_url, summary, is_demonstration, source_hash,
      created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18)
    RETURNING id, canonical_id, title, sector, region, location, buyer,
      estimated_value, currency, procurement_stage, published_date,
      closing_date, confidence, signal_tier, source_url, summary,
      is_demonstration, source_hash, created_at, updated_at`,
    [
      data.canonical_id,
      data.title,
      data.sector,
      data.region,
      data.location,
      data.buyer,
      data.estimated_value,
      data.currency,
      data.procurement_stage,
      data.published_date,
      data.closing_date,
      data.confidence,
      data.signal_tier,
      data.source_url,
      data.summary,
      true,
      data.source_hash ?? createHash("sha256").update(`${data.title}${Date.now()}`).digest("hex"),
    ],
  );
  return sanitizeOpportunity(result.rows[0], entitlementsFor("pro"));
}
