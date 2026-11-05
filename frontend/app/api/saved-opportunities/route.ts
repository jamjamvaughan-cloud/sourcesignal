/**
 * Saved opportunities API.
 *
 * GET    /api/saved-opportunities — list the current user's saved signals
 * POST   /api/saved-opportunities — save a signal
 *
 * Saved rows reference the canonical `signals` table. All operations are
 * owner-scoped and the returned signal is sanitised for the caller's plan
 * (Free users never receive Pro-only telemetry).
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor, type Entitlements } from "@/lib/entitlements";
import { error } from "@/lib/logger";

const MAX_ITEMS = 100;

const SECTOR_TO_TAXONOMY: Record<string, string> = {
  TECH: "technology-infrastructure",
  ENERGY: "energy",
  HEALTHCARE: "healthcare-infrastructure",
  PUBLIC_SECTOR: "public-sector-services",
  CONSTRUCTION: "construction",
  TRANSPORT: "transport",
  LOGISTICS: "logistics-and-distribution",
};

async function requireUser(
  request: NextRequest,
): Promise<
  { id: string; email: string; country: string | null } | NextResponse
> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return { id: user.id, email: user.email, country: user.country ?? null };
}

function currencyForJurisdiction(jurisdiction: unknown): string | null {
  switch (typeof jurisdiction === "string" ? jurisdiction.toUpperCase() : "") {
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

/** Free-tier embargo: Jan 1 2025 → 24 hours ago. */
const FREE_EMBARGO_SQL =
  "s.published_at >= '2025-01-01' AND s.published_at <= NOW() - INTERVAL '24 hours'";

function toSavedItem(
  row: Record<string, unknown>,
  entitlements: Entitlements,
): Record<string, unknown> {
  const hasFullDetails = entitlements.fullDetailsEnabled;
  const numericValue = Number(row.estimated_value);
  const estimatedValue =
    hasFullDetails && Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : null;

  return {
    id: row.saved_id,
    savedAt: row.saved_at,
    notes: row.notes ?? null,
    opportunity: {
      id: row.id,
      canonical_id: row.id,
      title: row.title,
      summary: hasFullDetails ? (row.commercial_why ?? null) : null,
      buyer: row.buyer_name ?? null,
      sector:
        (row.sector && SECTOR_TO_TAXONOMY[row.sector as string]) ??
        row.sector ??
        null,
      region: row.jurisdiction ?? null,
      country: row.jurisdiction ?? null,
      signal_tier: null,
      estimated_value: estimatedValue,
      currency:
        estimatedValue != null
          ? currencyForJurisdiction(row.jurisdiction)
          : null,
      procurement_stage: null,
      closing_date: null,
      source_url: row.source_url ?? null,
      source_name: row.source_name ?? null,
      published_date: row.published_at ?? null,
      commercial_why: hasFullDetails ? (row.commercial_why ?? null) : null,
      opportunity_type: row.opportunity_type ?? null,
      opportunity_score: null,
      vulnerability_trigger: null,
      winner: null,
    },
  };
}

export async function GET(request: NextRequest) {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId, country } = userOrError;

  try {
    const planId = await getUserPlanId(userId);
    const entitlements = entitlementsFor(planId);

    // Free users remain bound to their signup country and the 24h embargo
    // even for already-saved rows.
    if (!entitlements.fullDetailsEnabled && !country) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const conditions = ["so.user_id = $1"];
    const values: unknown[] = [userId];
    if (!entitlements.fullDetailsEnabled) {
      conditions.push(FREE_EMBARGO_SQL);
      conditions.push(`s.jurisdiction = $${values.length + 1}`);
      values.push(country);
    }

    const result = await query(
      `SELECT so.id AS saved_id,
              so.notes,
              so.created_at AS saved_at,
              s.id,
              s.title,
              s.buyer_name,
              s.sector,
              s.jurisdiction,
              s.opportunity_type,
              s.estimated_value,
              s.source_url,
              s.source_name,
              s.commercial_why,
              s.published_at
         FROM saved_opportunities so
         JOIN signals s ON s.id = so.opportunity_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${values.length + 1}`,
      [...values, MAX_ITEMS],
    );

    const items = result.rows.map((row) => toSavedItem(row, entitlements));

    return NextResponse.json({ items, total: items.length });
  } catch (err: unknown) {
    error("saved_opportunities_list_failed", {
      userId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to load saved signals." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId, country } = userOrError;

  const body = (await request.json().catch(() => ({}))) as {
    opportunityId?: unknown;
    notes?: unknown;
  };
  const opportunityId =
    typeof body.opportunityId === "string" ? body.opportunityId.trim() : "";

  if (!opportunityId) {
    return NextResponse.json(
      { error: "opportunityId is required." },
      { status: 400 },
    );
  }

  try {
    const planId = await getUserPlanId(userId);
    const entitlements = entitlementsFor(planId);

    // Free users may only save signals that are visible to them: their
    // signup country and outside the 24h embargo.
    if (!entitlements.fullDetailsEnabled && !country) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    const conditions = ["s.id = $2"];
    const values: unknown[] = [
      userId,
      opportunityId,
      typeof body.notes === "string" ? body.notes : null,
    ];
    if (!entitlements.fullDetailsEnabled) {
      conditions.push(FREE_EMBARGO_SQL);
      conditions.push(`s.jurisdiction = $${values.length + 1}`);
      values.push(country);
    }

    const insert = await query(
      `INSERT INTO saved_opportunities (user_id, opportunity_id, notes, created_at)
       SELECT $1, s.id, $3, NOW()
         FROM signals s
        WHERE ${conditions.join(" AND ")}
       ON CONFLICT (user_id, opportunity_id) DO NOTHING
       RETURNING id, created_at`,
      values,
    );

    if ((insert.rowCount ?? 0) === 0) {
      // Distinguish "already saved" from "signal not found".
      const existing = await query(
        `SELECT 1 FROM saved_opportunities
          WHERE user_id = $1 AND opportunity_id = $2`,
        [userId, opportunityId],
      );
      if ((existing.rowCount ?? 0) > 0) {
        return NextResponse.json({ error: "Already saved." }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        id: insert.rows[0].id,
        savedAt: insert.rows[0].created_at,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: string }).code
        : undefined;

    if (code === "23503") {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }
    if (code === "22P02") {
      return NextResponse.json(
        { error: "Invalid opportunityId." },
        { status: 400 },
      );
    }

    error("saved_opportunity_create_failed", {
      userId,
      opportunityId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to save this signal." },
      { status: 500 },
    );
  }
}
