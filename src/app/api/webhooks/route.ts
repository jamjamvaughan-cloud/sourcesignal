/**
 * Outbound webhook destination management.
 *
 * GET    /api/webhooks — list the caller's registered webhook destinations
 * POST   /api/webhooks — register a new webhook destination
 *
 * Destinations are user-scoped (webhooks.user_id). Outbound deliveries are
 * signed with HMAC-SHA256 using each destination's `secret` and logged to
 * `alert_logs` for audit. Requires an authenticated session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { query } from "@/lib/db";
import { isSafeDispatchUrl } from "@/lib/webhooks";
import { error, info } from "@/lib/logger";

async function requireUser(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Outbound webhooks are part of the Pro/Enterprise alerting feature.
  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  if (!entitlements.alertsEnabled) {
    return NextResponse.json(
      { error: "Webhooks require a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id };
}

export async function GET(request: NextRequest) {
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  try {
    const result = await query(
      `SELECT id, url, secret, sector_filters, min_value, is_active,
              created_at
         FROM webhooks
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId],
    );

    return NextResponse.json({
      items: result.rows.map((row) => ({
        id: row.id,
        url: row.url,
        secret: row.secret ?? null,
        sectorFilters: Array.isArray(row.sector_filters)
          ? (row.sector_filters as string[])
          : [],
        minValue:
          row.min_value === null || row.min_value === undefined
            ? null
            : Number(row.min_value),
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
      })),
      total: result.rowCount ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list webhooks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = await request.json().catch(() => ({}));
  const { url, secret, sectorFilters, minValue, isActive } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Webhook URL is required." }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid webhook URL." }, { status: 400 });
  }

  if (!isSafeDispatchUrl(url)) {
    return NextResponse.json(
      { error: "Webhook URL is not allowed (private/reserved address)." },
      { status: 400 },
    );
  }

  const parsedSectorFilters = Array.isArray(sectorFilters) && sectorFilters.length > 0
    ? sectorFilters.filter((item): item is string => typeof item === "string")
    : [];
  const parsedMinValue = minValue != null ? Number(minValue) : null;
  const parsedIsActive = isActive !== false;

  try {
    const insertResult = await query(
      `INSERT INTO webhooks (
            user_id, url, secret, sector_filters, min_value, is_active,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING id, url, secret, sector_filters, min_value, is_active,
                    created_at`,
      [
        userId,
        url,
        secret ?? null,
        parsedSectorFilters,
        parsedMinValue,
        parsedIsActive,
      ],
    );

    const row = insertResult.rows[0];
    info("webhook_registered", {
      message: "Webhook destination registered",
      userId,
      webhookId: row.id,
      url,
    });

    return NextResponse.json({
      id: row.id,
      url: row.url,
      secret: row.secret ?? null,
      sectorFilters: row.sector_filters ?? [],
      minValue: row.min_value === null ? null : Number(row.min_value),
      isActive: row.is_active,
      createdAt: row.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to register webhook.";
    error("webhook_register", { error: message, userId, url });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
