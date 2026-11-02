/**
 * Saved opportunities API.
 *
 * GET    /api/saved-opportunities — list the current user's saved signals
 * POST   /api/saved-opportunities — save an opportunity
 *
 * All operations are owner-scoped: users can only access their own saved
 * items. Implemented with native PostgreSQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { error } from "@/lib/logger";

const MAX_ITEMS = 100;

async function requireUser(
  request: NextRequest,
): Promise<{ id: string; email: string } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return { id: user.id, email: user.email };
}

export async function GET(request: NextRequest) {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId } = userOrError;

  try {
    const result = await query(
      `SELECT so.id,
              so.notes,
              so.created_at AS saved_at,
              o.id AS opportunity_id,
              o.canonical_id,
              o.title,
              o.summary,
              o.buyer,
              o.sector,
              o.region,
              o.country,
              o.signal_tier,
              o.estimated_value,
              o.currency,
              o.procurement_stage,
              o.closing_date,
              o.source_url
         FROM saved_opportunities so
         JOIN opportunities o ON o.id = so.opportunity_id
        WHERE so.user_id = $1
        ORDER BY so.created_at DESC
        LIMIT $2`,
      [userId, MAX_ITEMS],
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      savedAt: row.saved_at,
      notes: row.notes ?? null,
      opportunity: {
        id: row.opportunity_id,
        canonical_id: row.canonical_id,
        title: row.title,
        summary: row.summary ?? null,
        buyer: row.buyer ?? null,
        sector: row.sector,
        region: row.region,
        country: row.country ?? null,
        signal_tier: row.signal_tier,
        estimated_value:
          row.estimated_value != null ? Number(row.estimated_value) : null,
        currency: row.currency ?? null,
        procurement_stage: row.procurement_stage ?? null,
        closing_date: row.closing_date ?? null,
        source_url: row.source_url ?? null,
      },
    }));

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
  const { id: userId } = userOrError;

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
    const insert = await query(
      `INSERT INTO saved_opportunities (user_id, opportunity_id, notes, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, opportunity_id) DO NOTHING
       RETURNING id, created_at`,
      [
        userId,
        opportunityId,
        typeof body.notes === "string" ? body.notes : null,
      ],
    );

    if ((insert.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Already saved." }, { status: 409 });
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

    // FK violation → the opportunity does not exist.
    if (code === "23503") {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }
    // Invalid UUID syntax.
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
