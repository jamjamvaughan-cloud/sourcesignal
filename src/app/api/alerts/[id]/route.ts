/**
 * Update or delete an alert.
 *
 * PATCH  /api/alerts/[id]
 * DELETE /api/alerts/[id]
 *
 * Both operations are owner-scoped. Criteria are stored in
 * `alerts.query_filters` (JSONB); the active flag lives in `is_active`.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import {
  isInvalidUuidError,
  parseAlertFilters,
  validateAlertFilters,
} from "@/lib/alert-filters";
import { error } from "@/lib/logger";

async function requireUser(
  request: NextRequest,
): Promise<{ userId: string } | NextResponse> {
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

  return { userId: user.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alertId } = await params;
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (
    body.name !== undefined &&
    (typeof body.name !== "string" || !body.name.trim())
  ) {
    return NextResponse.json(
      { error: "Alert name cannot be empty." },
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

  try {
    const existing = await query(
      `SELECT query_filters FROM alerts WHERE id = $1 AND user_id = $2`,
      [alertId, userId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const current = parseAlertFilters(existing.rows[0].query_filters);
    const merged = { ...current, ...validation.filters };

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      values.push((body.name as string).trim());
      updates.push(`name = $${values.length}`);
    }
    if (Object.keys(validation.filters).length > 0) {
      values.push(JSON.stringify(merged));
      updates.push(`query_filters = $${values.length}::jsonb`);
    }
    if (body.enabled !== undefined) {
      values.push(body.enabled !== false);
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 },
      );
    }

    updates.push("updated_at = NOW()");
    values.push(alertId, userId);
    const idParam = values.length - 1;
    const userParam = values.length;

    const updated = await query(
      `UPDATE alerts
          SET ${updates.join(", ")}
        WHERE id = $${idParam} AND user_id = $${userParam}
        RETURNING id, name, is_active`,
      values,
    );

    if ((updated.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const row = updated.rows[0];
    return NextResponse.json({
      id: row.id,
      name: row.name,
      enabled: row.is_active,
    });
  } catch (err: unknown) {
    if (isInvalidUuidError(err)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    error("alert_update_failed", {
      userId,
      alertId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to update the alert." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alertId } = await params;
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  try {
    const deleted = await query(
      `DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [alertId, userId],
    );

    if ((deleted.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (isInvalidUuidError(err)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    error("alert_delete_failed", {
      userId,
      alertId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to delete the alert." },
      { status: 500 },
    );
  }
}
