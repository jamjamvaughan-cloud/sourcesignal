/**
 * Alerts API.
 *
 * GET    /api/alerts — list user's alerts
 * POST   /api/alerts — create an alert
 * PATCH  /api/alerts/[id] — update an alert (enable/disable, modify criteria)
 * DELETE /api/alerts/[id] — delete an alert
 *
 * All operations are owner-scoped: users can only access their own alerts.
 * Alerts are a Pro feature; Free users cannot create or manage alerts.
 *
 * Stored in PostgreSQL:
 *   alerts.query_filters JSONB → { sectors, regions, keywords }
 *   alerts.is_active          → the API's `enabled` flag
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import {
  EMPTY_ALERT_FILTERS,
  parseAlertFilters,
  validateAlertFilters,
} from "@/lib/alert-filters";
import { error } from "@/lib/logger";

const MAX_ALERTS = 50;

interface AlertRow {
  id: string;
  name: string;
  query_filters: unknown;
  is_active: boolean;
  created_at: string | Date;
  last_triggered: string | Date | null;
}

function toIso(value: string | Date | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

async function requireUserAndEntitlements(
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

  if (!entitlements.alertsEnabled) {
    return NextResponse.json(
      { error: "Alerts require a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id, entitlements };
}

export async function GET(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  try {
    const rows = await query(
      `SELECT a.id,
              a.name,
              a.query_filters,
              a.is_active,
              a.created_at,
              (SELECT MAX(d.delivered_at)
                 FROM alert_deliveries d
                WHERE d.alert_id = a.id) AS last_triggered
         FROM alerts a
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2`,
      [userId, MAX_ALERTS],
    );

    const items = (rows.rows as AlertRow[]).map((row) => {
      const filters = parseAlertFilters(row.query_filters);
      return {
        id: row.id,
        name: row.name,
        sectors: filters.sectors,
        regions: filters.regions,
        keywords: filters.keywords,
        enabled: row.is_active,
        lastTriggered: toIso(row.last_triggered),
        createdAt: toIso(row.created_at),
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err: unknown) {
    error("alerts_list_failed", {
      userId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to load alerts." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const { name, enabled } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Alert name is required." },
      { status: 400 },
    );
  }

  const validation = validateAlertFilters({
    sectors: body.sectors,
    regions: body.regions,
    keywords: body.keywords,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const filters = { ...EMPTY_ALERT_FILTERS, ...validation.filters };

  try {
    const inserted = await query(
      `INSERT INTO alerts (user_id, name, query_filters, is_active, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
       RETURNING id, name, is_active`,
      [userId, name.trim(), JSON.stringify(filters), enabled !== false],
    );

    const row = inserted.rows[0];
    return NextResponse.json(
      { id: row.id, name: row.name, enabled: row.is_active },
      { status: 201 },
    );
  } catch (err: unknown) {
    error("alert_create_failed", {
      userId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to create the alert." },
      { status: 500 },
    );
  }
}
