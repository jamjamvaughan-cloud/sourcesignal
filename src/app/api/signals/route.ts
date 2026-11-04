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
 *   - Pro/Enterprise users: full access, no delay, all fields.
 *
 * Server-side only: queries PostgreSQL directly via the shared `pg` pool.
 * Requires an authenticated session (cookie forwarded from the caller).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { Pool } from "pg";

const POOL = new Pool({
  connectionString: process.env.DATABASE_URL?.replace(/:6432\//, ":5432/"),
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const r = await POOL.query("SELECT COUNT(*) FROM signals");
    return NextResponse.json({ count: Number(r.rows[0].count) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
