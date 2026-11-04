/**
 * Primary signals API.
 *
 * GET /api/signals
 *
 * Returns normalized primary-source signals from the PostgreSQL `signals`
 * table, ordered by the source's own `published_at` timestamp (historical
 * dates preserved), with optional sector / opportunity-type / keyword
 * filtering and pagination.
 *
 * Tier gating:
 *   - Free users: historical catalog from Jan 1, 2025 through yesterday
  *     (published_at >= '2025-01-01' AND published_at <= NOW() - INTERVAL
  *     '24 hours'). Pro-only fields are stripped.
   *   - Pro/Enterprise users: full access, no delay, all fields.
 *
 * Server-side only: queries PostgreSQL directly via the shared `pg` pool.
 * Requires an authenticated session (cookie forwarded from the caller).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { query } from "@/lib/db";

/** Maps ingestion `sector` enum values to the controlled taxonomy ids used
 *  by the dashboard (so `sectorLabel()` and client-side filtering work). */
const SECTOR_TO_TAXONOMY: Record<string, string> = {
  TECH: "technology-infrastructure",
  ENERGY: "energy",
  HEALTHCARE: "healthcare-infrastructure",
  PUBLIC_SECTOR: "public-sector-services",
  CONSTRUCTION: "construction",
  TRANSPORT: "transport",
  LOGISTICS: "logistics-and-distribution",
};

/** Dashboard taxonomy id → ingestion enum (for SQL filtering). */
const TAXONOMY_TO_SECTOR: Record<string, string> = Object.fromEntries(
  Object.entries(SECTOR_TO_TAXONOMY).map(([enumValue, taxonomy]) => [
    taxonomy,
    enumValue,
  ]),
);

const SIGNAL_SECTORS = new Set(Object.keys(SECTOR_TO_TAXONOMY));

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

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

/** Free users see signals from Jan 1, 2025 through yesterday (24h embargo). */
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

/** Build a SignalRecord from a DB row, applying tier-based field redaction. */
function toSignalRecord(row: SignalRow, entitlements: ReturnType<typeof entitlementsFor>) {
  const isPro = entitlements.fullDetailsEnabled || entitlements.alertsEnabled;

  return {
    id: row.id,
    canonical_id: row.id,
    title: row.title ?? row.buyer_name ?? "Untitled signal",
    buyer: row.buyer_name ?? null,
    sector: (row.sector && SECTOR_TO_TAXONOMY[row.sector]) ?? row.sector ?? null,
    region: row.jurisdiction ?? null,
    country: row.jurisdiction ?? null,
    location: null,
    // estimated_value is Pro-only (fullDetailsEnabled).
    estimated_value:
      entitlements.fullDetailsEnabled &&
      (typeof row.estimated_value === "number" ||
        (typeof row.estimated_value === "string" &&
          Number.isFinite(Number(row.estimated_value))))
        ? Number(row.estimated_value)
        : null,
    currency: entitlements.fullDetailsEnabled
      ? currencyForJurisdiction(row.jurisdiction)
      : null,
    procurement_stage: null,
    published_date: row.published_at,
    closing_date: null,
    confidence: null,
    signal_tier: null,
    source_url: row.source_url ?? null,
    source_name: row.source_name ?? null,
    source_captured_at: row.created_at ?? null,
    source_hash: row.source_hash ?? null,
    sha256_hash: row.sha256_hash ?? null,
    summary: null,
    is_demonstration: false,
    created_at: row.created_at ?? null,
    updated_at: null,
    // vulnerability_trigger and winner are not columns on the signals table;
    // they exist on the legacy opportunities table. Always null here.
    vulnerability_trigger: null,
    winner: null,
    opportunity_score: null,
    opportunity_type: row.opportunity_type ?? null,
    // commercial_why is a Pro-only field; Free users get null so the client
    // can render it as "Locked / Blurred".
    commercial_why: isPro ? (row.commercial_why ?? null) : null,
    supplier_capabilities: null,
    sub_category: null,
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  const isPro = entitlements.fullDetailsEnabled || entitlements.alertsEnabled;

  const { searchParams } = new URL(request.url);
  const sector = searchParams.get("sector") || undefined;
  const type =
    searchParams.get("type") || searchParams.get("opportunity_type") || undefined;
  const search = searchParams.get("search") || undefined;
  const requestedRegion = searchParams.get("region") || undefined;
  // Free users only ever see their signup country; Pro users may switch.
  const region = isPro ? requestedRegion : (user.country ?? undefined);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number(searchParams.get("perPage")) || DEFAULT_PER_PAGE),
  );

  // Fail closed: a Free account with no stored signup country must not fall
  // through to an unfiltered global feed.
  if (!isPro && !region) {
    return NextResponse.json({
      items: [],
      page,
      perPage,
      total: 0,
      hasMore: false,
      isPro,
    });
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (sector) {
    const enumValue =
      TAXONOMY_TO_SECTOR[sector] ??
      (SIGNAL_SECTORS.has(sector.toUpperCase()) ? sector.toUpperCase() : null);
    if (enumValue) {
      conditions.push(`sector = $${paramIndex++}::signal_sector`);
      params.push(enumValue);
    }
  }
  if (type) {
    const normalisedType = type.trim().toUpperCase();
    if (normalisedType) {
      conditions.push(`opportunity_type = $${paramIndex++}::signal_opportunity_type`);
      params.push(normalisedType);
    }
  }
  if (search) {
    conditions.push(
      `(title ILIKE $${paramIndex} OR buyer_name ILIKE $${paramIndex} OR commercial_why ILIKE $${paramIndex})`,
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Users only see signals from their own signup country.
  if (region) {
    conditions.push(`jurisdiction = $${paramIndex++}`);
    params.push(region);
  }

  // Free users: historical catalog from Jan 1, 2025 through yesterday
  // (24h embargo on newly ingested signals).
  if (!isPro) {
    conditions.push(
      `published_at >= '${FREE_EMBARGO_START}' AND published_at <= NOW() - INTERVAL '${EMBARGO_HOURS} hours'`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  console.log("SIGNALS_DEBUG: where=", where);
  console.log("SIGNALS_DEBUG: params=", JSON.stringify(params));
  console.log("SIGNALS_DEBUG: region=", region);
  console.log("SIGNALS_DEBUG: isPro=", isPro);

  const countResult = await query(
    `SELECT COUNT(*) FROM signals ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);
  console.log("SIGNALS_DEBUG: count result=", total);

  const offset = (page - 1) * perPage;
  const dataResult = await query(
    `SELECT id, title, buyer_name, jurisdiction, sector, opportunity_type,
            estimated_value, source_name, source_url, source_hash,
            sha256_hash, commercial_why, published_at, created_at
       FROM signals
       ${where}
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, perPage, offset],
  );

  const items = dataResult.rows.map((row) =>
    toSignalRecord(row as SignalRow, entitlements),
  );

  return NextResponse.json({
    items,
    page,
    perPage,
    total,
    hasMore: offset + items.length < total,
    isPro,
  });
}

export const dynamic = "force-dynamic";
