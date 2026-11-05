/**
 * Webhook Subscription API (Zero CRM Bloat & Frictionless Hand-Off).
 *
 * POST   /api/alerts/webhook — register a webhook URL to receive signals
 * GET    /api/alerts/webhook — list user's webhook subscriptions
 *
 * Users can configure outbound webhooks to stream high-intent signals
 * directly to Slack, Teams, Zapier, Make, or their own tech stack.
 * No CRM lock-in — data flows out via standard webhooks.
 *
 * Requires Pro subscription.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  getUserOrganisation,
  getUserPlanId,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { info, error } from "@/lib/logger";

async function requireUserAndEntitlements(
  request: NextRequest,
): Promise<{
  userId: string;
  orgId: string | null;
  entitlements: ReturnType<typeof entitlementsFor>;
} | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  if (!entitlements.alertsEnabled) {
    return NextResponse.json(
      { error: "Webhooks require a Pro subscription." },
      { status: 403 },
    );
  }

  // Webhook subscriptions belong to the user's primary organisation.
  const organisation = await getUserOrganisation(user.id);

  return {
    userId: user.id,
    orgId: organisation?.id ?? null,
    entitlements,
  };
}

export async function GET(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  if (!orgId) {
    return NextResponse.json({ items: [], total: 0 });
  }

  try {
    const result = await query(
      `SELECT id, url, secret, event_types, min_tier, min_confidence,
              is_active, total_deliveries, failed_deliveries,
              last_delivery_at, created_at, updated_at
         FROM webhook_subscriptions
        WHERE organisation_id = $1
        ORDER BY created_at DESC`,
      [orgId],
    );

    return NextResponse.json({
      items: result.rows.map((row) => ({
        id: row.id,
        url: row.url,
        secret: row.secret ?? null,
        eventTypes: row.event_types ?? ["opportunity.created"],
        minTier: row.min_tier,
        minConfidence: row.min_confidence ?? 0,
        isActive: row.is_active,
        totalDeliveries: row.total_deliveries ?? 0,
        failedDeliveries: row.failed_deliveries ?? 0,
        lastDeliveryAt: row.last_delivery_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: result.rowCount ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list webhooks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { userId, orgId } = result;

  if (!orgId) {
    return NextResponse.json(
      { error: "No organisation found. Create an organisation first." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    url,
    secret,
    eventTypes,
    minTier,
    minConfidence,
    isActive,
  } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Webhook URL is required." }, { status: 400 });
  }

  // Validate URL format.
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid webhook URL." }, { status: 400 });
  }

  const parsedEventTypes = Array.isArray(eventTypes) && eventTypes.length > 0
    ? eventTypes
    : ["opportunity.created"];
  const parsedMinTier = minTier || "STANDARD_COMMERCIAL";
  const parsedMinConfidence = minConfidence != null ? Number(minConfidence) : 0;
  const parsedIsActive = isActive !== false;

  try {
    const insertResult = await query(
      `INSERT INTO webhook_subscriptions (
            organisation_id, url, secret, event_types, min_tier,
            min_confidence, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING id, url, secret, event_types, min_tier, min_confidence,
                    is_active, total_deliveries, failed_deliveries,
                    last_delivery_at, created_at, updated_at`,
      [
        orgId,
        url,
        secret ?? null,
        JSON.stringify(parsedEventTypes),
        parsedMinTier,
        parsedMinConfidence,
        parsedIsActive,
      ],
    );

    const row = insertResult.rows[0];
    info("webhook_subscription", {
      message: "Webhook subscription created",
      organisationId: orgId,
      userId,
      url,
    });

    return NextResponse.json({
      id: row.id,
      url: row.url,
      secret: row.secret ?? null,
      eventTypes: row.event_types ?? ["opportunity.created"],
      minTier: row.min_tier,
      minConfidence: row.min_confidence ?? 0,
      isActive: row.is_active,
      totalDeliveries: row.total_deliveries ?? 0,
      failedDeliveries: row.failed_deliveries ?? 0,
      lastDeliveryAt: row.last_delivery_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create webhook subscription.";
    error("webhook_subscription", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
