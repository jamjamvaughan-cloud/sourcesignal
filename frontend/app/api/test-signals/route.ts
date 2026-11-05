import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const POOL = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
  });
  try {
    const r = await POOL.query("SELECT COUNT(*) FROM signals");
    return NextResponse.json({ count: r.rows[0].count, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await POOL.end();
  }
}
