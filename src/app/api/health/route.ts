/**
 * Health check endpoint.
 *
 * GET /api/health
 *
 * Reports application readiness by executing a native `SELECT 1` query
 * against PostgreSQL via the shared query helper.
 *
 * Returns HTTP 200 with { status: "ok", db: "connected", timestamp: "..." }
 * when the database is reachable, or HTTP 503 otherwise.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  try {
    await query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database connection failed.";
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        timestamp: new Date().toISOString(),
        error: message,
      },
      { status: 503 },
    );
  }
}
