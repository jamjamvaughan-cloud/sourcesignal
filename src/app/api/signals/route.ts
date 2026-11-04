/**
 * Primary signals API.
 *
 * GET /api/signals
 *
 * Returns normalized primary-source signals from the PostgreSQL `signals`
 * table.
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const POOL = new Pool({
  connectionString: process.env.DATABASE_URL?.replace(/:6432\//, ":5432/"),
  max: 20,
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
