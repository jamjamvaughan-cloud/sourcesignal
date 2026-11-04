/**
 * Export API (Phase I).
 *
 * GET /api/exports/csv  — CSV export for Pro users
 * GET /api/exports/json — JSON export for Pro users
 *
 * Exports only fields the user is permitted to access based on their plan.
 * Free users are denied with 403. CSV fields are escaped to prevent
 * formula injection.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor, permittedOpportunityFields } from "@/lib/entitlements";
import { isValidSectorId, isValidRegion } from "@/lib/config";
import { error } from "@/lib/logger";

const MAX_EXPORT_ROWS = 1000;

/** Dashboard taxonomy id → ingestion `signal_sector` enum. */
const TAXONOMY_TO_SECTOR: Record<string, string> = {
  "technology-infrastructure": "TECH",
  energy: "ENERGY",
  "healthcare-infrastructure": "HEALTHCARE",
  "public-sector-services": "PUBLIC_SECTOR",
  construction: "CONSTRUCTION",
  transport: "TRANSPORT",
  "logistics-and-distribution": "LOGISTICS",
};

async function requirePro(
  request: NextRequest,
): Promise<
  | { userId: string; entitlements: ReturnType<typeof entitlementsFor> }
  | NextResponse
> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  if (!entitlements.exportsEnabled) {
    return NextResponse.json(
      { error: "Exports require a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id, entitlements };
}

/** Normalises dates/JSON values before CSV/JSON serialisation. */
function normaliseValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Escapes a CSV field to prevent formula injection and handle special chars.
 */
function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  let str = String(normaliseValue(value));
  // If the field starts with =, +, -, @, or tab, prepend a tab to prevent
  // spreadsheet formula injection.
  if (/^[=+\-@\t]/.test(str)) {
    str = "\t" + str;
  }
  // If the field contains a comma, quote, or newline, wrap in quotes and
  // escape internal quotes by doubling them.
  if (/[,"\n\r]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ format: string }> },
) {
  const { format } = await params;
  const result = await requirePro(request);
  if (result instanceof NextResponse) return result;
  const { entitlements, userId } = result;

  const searchParams = request.nextUrl.searchParams;
  const sector = searchParams.get("sector") || undefined;
  const region = searchParams.get("region") || undefined;
  const limit = Math.min(
    MAX_EXPORT_ROWS,
    Math.max(1, Number(searchParams.get("limit")) || 100),
  );

  // Validate filters.
  if (sector && !isValidSectorId(sector)) {
    return NextResponse.json(
      { error: `Invalid sector: ${sector}` },
      { status: 400 },
    );
  }
  if (region && !isValidRegion(region)) {
    return NextResponse.json(
      { error: `Invalid region: ${region}` },
      { status: 400 },
    );
  }

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (sector) {
    const enumValue = TAXONOMY_TO_SECTOR[sector] ?? sector.toUpperCase();
    values.push(enumValue);
    conditions.push(`sector = $${values.length}::signal_sector`);
  }
  if (region) {
    values.push(region.toUpperCase());
    conditions.push(`jurisdiction = $${values.length}`);
  }
  values.push(limit);

  try {
    // Project the canonical `signals` row into the legacy opportunity field
    // names consumed by the export contract.
    const records = await query(
      `SELECT id,
              id AS canonical_id,
              title,
              commercial_why AS summary,
              buyer_name AS buyer,
              sector::text AS sector,
              jurisdiction AS region,
              jurisdiction AS country,
              NULL AS location,
              published_at AS published_date,
              NULL AS closing_date,
              NULL AS procurement_stage,
              source_url,
              source_name,
              source_hash,
              created_at AS source_captured_at,
              NULL AS confidence,
              NULL AS signal_tier,
              opportunity_type::text AS opportunity_type,
              NULL AS sub_category,
              NULL AS supplier_capabilities,
              created_at,
              created_at AS updated_at,
              FALSE AS is_demonstration,
              estimated_value,
              CASE jurisdiction
                WHEN 'US' THEN 'USD'
                WHEN 'EU' THEN 'EUR'
                ELSE 'GBP'
              END AS currency,
              NULL AS opportunity_score,
              commercial_why,
              NULL AS vulnerability_trigger,
              NULL AS winner,
              NULL AS latitude,
              NULL AS longitude,
              NULL AS detail_fields
         FROM signals
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        ORDER BY COALESCE(published_at, created_at) DESC
        LIMIT $${values.length}`,
      values,
    );

    const permitted = permittedOpportunityFields(entitlements);
    const sanitized = records.rows.map((item) => {
      const out: Record<string, unknown> = {};
      for (const field of permitted) {
        if (field in item) {
          out[field] = normaliseValue(item[field]);
        }
      }
      return out;
    });

    if (format === "csv") {
      const headers = permitted.join(",");
      const rows = sanitized.map((item) =>
        permitted.map((field) => escapeCsvField(item[field])).join(","),
      );
      const csv = [headers, ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="opportunities-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (format === "json") {
      const json = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          count: sanitized.length,
          fields: permitted,
          data: sanitized,
        },
        null,
        2,
      );

      return new NextResponse(json, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="opportunities-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid format. Use 'csv' or 'json'." },
      { status: 400 },
    );
  } catch (err: unknown) {
    error("export_failed", {
      userId,
      format,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to generate the export." },
      { status: 500 },
    );
  }
}
