/**
 * Server-side opportunity service.
 *
 * The canonical datastore for ingested commercial signals is the `signals`
 * table (populated by the ingestion engine). This module exposes those rows
 * through the legacy "opportunity" shape used by the dashboard and previews,
 * applying entitlement sanitisation before anything leaves the server.
 *
 * The old `opportunities` table is retained for backwards compatibility but is
 * no longer the read path for the product UI.
 */

import { query } from "@/lib/db";
import {
  sanitizeOpportunity,
  type Entitlements,
} from "@/lib/entitlements";

export interface OpportunityFilters {
  sector?: string;
  region?: string;
  country?: string;
  q?: string;
  stage?: string;
  page?: number;
  perPage?: number;
  sort?: string;
  /** When set, restrict results to this jurisdiction (Free-tier country lock). */
  jurisdiction?: string;
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

/** Ingestion enum → dashboard taxonomy id. */
const SECTOR_ENUM_TO_TAXONOMY: Record<string, string> = {
  TECH: "technology-infrastructure",
  ENERGY: "energy",
  HEALTHCARE: "healthcare-infrastructure",
  PUBLIC_SECTOR: "public-sector-services",
  CONSTRUCTION: "construction",
  TRANSPORT: "transport",
  LOGISTICS: "logistics-and-distribution",
};

/** Dashboard taxonomy id → ingestion enum (for SQL filtering). */
const SECTOR_TAXONOMY_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(SECTOR_ENUM_TO_TAXONOMY).map(([enumValue, taxonomy]) => [
    taxonomy,
    enumValue,
  ]),
);

const SIGNAL_SECTORS = new Set(Object.keys(SECTOR_ENUM_TO_TAXONOMY));
const JURISDICTIONS = new Set(["UK", "US", "EU"]);

const FREE_EMBARGO_START = "2025-01-01";
const EMBARGO_HOURS = 24;

interface SignalRow {
  id: string;
  title: string | null;
  buyer_name: string | null;
  jurisdiction: string | null;
  sector: string | null;
  opportunity_type: string | null;
  estimated_value: unknown;
  source_name: string | null;
  source_url: string | null;
  source_hash: string | null;
  sha256_hash: string | null;
  commercial_why: string | null;
  published_at: string | null;
  created_at: string | null;
}

function currencyForJurisdiction(jurisdiction: string | null): string | null {
  switch ((jurisdiction ?? "").toUpperCase()) {
    case "UK":
      return "GBP";
    case "US":
      return "USD";
    case "EU":
      return "EUR";
    default:
      return null;
  }
}

/**
 * Maps a `signals` row into the legacy opportunity shape and strips any
 * fields the caller's plan is not entitled to.
 */
function toOpportunity(
  row: SignalRow,
  entitlements: Entitlements,
): Record<string, unknown> {
  const hasFullDetails = entitlements.fullDetailsEnabled;
  const numericValue = Number(row.estimated_value);
  const estimatedValue =
    hasFullDetails && Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : null;

  const record: Record<string, unknown> = {
    id: row.id,
    canonical_id: row.id,
    title: row.title ?? row.buyer_name ?? "Untitled signal",
    summary: hasFullDetails ? (row.commercial_why ?? null) : null,
    buyer: row.buyer_name ?? null,
    country: row.jurisdiction ?? null,
    region: row.jurisdiction ?? null,
    location: null,
    sector:
      (row.sector && SECTOR_ENUM_TO_TAXONOMY[row.sector]) ?? row.sector ?? null,
    signal_tier: null,
    estimated_value: estimatedValue,
    currency: estimatedValue != null ? currencyForJurisdiction(row.jurisdiction) : null,
    procurement_stage: null,
    published_date: row.published_at ?? null,
    closing_date: null,
    confidence: null,
    source_url: row.source_url ?? null,
    source_name: row.source_name ?? null,
    source_captured_at: row.created_at ?? null,
    source_hash: row.source_hash ?? null,
    sha256_hash: row.sha256_hash ?? null,
    is_demonstration: false,
    created_at: row.created_at ?? null,
    updated_at: null,
    vulnerability_trigger: null,
    winner: null,
    sub_category: null,
    opportunity_type: row.opportunity_type ?? null,
    opportunity_score: null,
    commercial_why: hasFullDetails ? (row.commercial_why ?? null) : null,
    supplier_capabilities: [],
  };

  return sanitizeOpportunity(record, entitlements);
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

  const hasFullDetails = entitlements.fullDetailsEnabled;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Free-tier country lock and embargo are applied here as well as in the
  // route handler so no caller can bypass them.
  if (!hasFullDetails) {
    conditions.push(
      `published_at >= '${FREE_EMBARGO_START}' AND published_at <= NOW() - INTERVAL '${EMBARGO_HOURS} hours'`,
    );
  }

  const jurisdiction = filters.jurisdiction?.trim().toUpperCase();
  if (jurisdiction && JURISDICTIONS.has(jurisdiction)) {
    conditions.push(`jurisdiction = $${paramIndex++}`);
    params.push(jurisdiction);
  } else if (filters.country) {
    const country = filters.country.trim().toUpperCase();
    if (JURISDICTIONS.has(country)) {
      conditions.push(`jurisdiction = $${paramIndex++}`);
      params.push(country);
    }
  } else if (filters.region) {
    const region = filters.region.trim().toUpperCase();
    if (JURISDICTIONS.has(region)) {
      conditions.push(`jurisdiction = $${paramIndex++}`);
      params.push(region);
    }
  }

  if (filters.sector) {
    const sector = filters.sector.trim();
    const enumValue =
      SECTOR_TAXONOMY_TO_ENUM[sector] ??
      (SIGNAL_SECTORS.has(sector.toUpperCase()) ? sector.toUpperCase() : null);
    if (enumValue) {
      conditions.push(`sector = $${paramIndex++}::signal_sector`);
      params.push(enumValue);
    }
  }

  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      `(title ILIKE $${paramIndex} OR buyer_name ILIKE $${paramIndex} OR commercial_why ILIKE $${paramIndex})`,
    );
    params.push(term);
    paramIndex++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Only publish-descending ordering is meaningful for signals (there is no
  // closing date, stage or value score in the canonical table).
  const orderBy = "published_at DESC NULLS LAST, created_at DESC";
  const offset = (page - 1) * perPage;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM signals ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const result = await query(
    `SELECT id, title, buyer_name, jurisdiction, sector, opportunity_type,
            estimated_value, source_name, source_url, source_hash,
            sha256_hash, commercial_why, published_at, created_at
       FROM signals
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, perPage, offset],
  );

  const items = (result.rows as SignalRow[]).map((row) =>
    toOpportunity(row, entitlements),
  );

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getOpportunity(
  id: string,
  entitlements: Entitlements,
  options: { jurisdiction?: string | null } = {},
): Promise<Record<string, unknown> | null> {
  const conditions = ["id = $1"];
  const params: unknown[] = [id];

  if (!entitlements.fullDetailsEnabled) {
    conditions.push(
      `published_at >= '${FREE_EMBARGO_START}' AND published_at <= NOW() - INTERVAL '${EMBARGO_HOURS} hours'`,
    );
  }

  if (options.jurisdiction) {
    const jurisdiction = options.jurisdiction.trim().toUpperCase();
    if (JURISDICTIONS.has(jurisdiction)) {
      conditions.push(`jurisdiction = $${params.length + 1}`);
      params.push(jurisdiction);
    }
  }

  const result = await query(
    `SELECT id, title, buyer_name, jurisdiction, sector, opportunity_type,
            estimated_value, source_name, source_url, source_hash,
            sha256_hash, commercial_why, published_at, created_at
       FROM signals
      WHERE ${conditions.join(" AND ")}`,
    params,
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return toOpportunity(result.rows[0] as SignalRow, entitlements);
}
