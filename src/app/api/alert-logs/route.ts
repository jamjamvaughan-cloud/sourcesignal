/**
 * Alert / Webhook Delivery Logs API.
 *
 * GET /api/alert-logs
 *
 * Returns delivery attempts from `alert_logs`, ordered by most recent first.
 * Optionally filter by `webhookId`. Results are paginated.
 *
 * Requires an authenticated session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get("webhookId") || undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number(searchParams.get("perPage")) || DEFAULT_PER_PAGE),
  );

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (webhookId) {
    conditions.push(`webhook_id = $${paramIndex++}`);
    params.push(webhookId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT COUNT(*) FROM alert_logs ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  const offset = (page - 1) * perPage;
  const dataResult = await query(
    `SELECT id, webhook_id, signal_id, status, response_status_code, attempted_at
       FROM alert_logs
       ${where}
       ORDER BY attempted_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, perPage, offset],
  );

  const items = dataResult.rows.map((row) => ({
    id: row.id,
    webhookId: row.webhook_id,
    signalId: row.signal_id,
    status: row.status,
    responseStatusCode: row.response_status_code,
    attemptedAt: row.attempted_at,
  }));

  return NextResponse.json({
    items,
    page,
    perPage,
    total,
    hasMore: offset + items.length < total,
  });
}

export const dynamic = "force-dynamic";
