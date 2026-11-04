import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const POOL = new Pool({
  connectionString: process.env.DATABASE_URL?.replace(/:6432\//, ":5432/"),
});

export async function GET() {
  try {
    const r = await POOL.query("SELECT COUNT(*) FROM signals");
    return NextResponse.json({ count: r.rows[0].count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
