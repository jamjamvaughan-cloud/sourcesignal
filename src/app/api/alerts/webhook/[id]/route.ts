/**
 * Webhook Subscription Detail API (Zero CRM Bloat & Frictionless Hand-Off).
 *
 * PATCH  /api/alerts/webhook/[id] — update a webhook subscription
 * DELETE /api/alerts/webhook/[id] — delete a webhook subscription
 *
 * Users can update or remove their outbound webhook subscriptions at any time.
 * Requires Pro subscription and ownership of the subscription.
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

async function requireOwner(
  request: NextRequest,
  webhookId: string,
): Promise<{
  userId: string;
  orgId: string;
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

  // Verify ownership of the webhook subscription through the caller's org.
  const organisation = await getUserOrganisation(user.id);
  if (!organisation) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await query(
    `SELECT id FROM webhook_subscriptions
      WHERE id = $1 AND organisation_id = $2`,
    [webhookId, organisation.id],
  );
  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return { userId: user.id, orgId: organisation.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: webhookId } = await params;
  const result = await requireOwner(request, webhookId);
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const body = await request.json().catch(() => ({}));
  const { url, secret, eventTypes, minTier, minConfidence, isActive } = body;

  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (url !== undefined) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL." }, { status: 400 });
    }
    updateFields.push(`url = $${paramIndex++}`);
    values.push(url);
  }
  if (secret !== undefined) {
    updateFields.push(`secret = $${paramIndex++}`);
    values.push(secret);
  }
  if (eventTypes !== undefined && Array.isArray(eventTypes)) {
    updateFields.push(`event_types = $${paramIndex++}`);
    values.push(JSON.stringify(eventTypes));
  }
  if (minTier !== undefined) {
    updateFields.push(`min_tier = $${paramIndex++}`);
    values.push(minTier);
  }
  if (minConfidence !== undefined) {
    updateFields.push(`min_confidence = $${paramIndex++}`);
    values.push(Number(minConfidence));
  }
  if (isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }

  if (updateFields.length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(webhookId, orgId);

  try {
    await query(
      `UPDATE webhook_subscriptions
            SET ${updateFields.join(", ")}
          WHERE id = $${paramIndex++} AND organisation_id = $${paramIndex++}`,
      values,
    );

    info("webhook_subscription", {
      message: "Webhook subscription updated",
      webhookId,
      organisationId: orgId,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update webhook subscription.";
    error("webhook_subscription", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: webhookId } = await params;
  const result = await requireOwner(request, webhookId);
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  try {
    await query(
      `DELETE FROM webhook_subscriptions WHERE id = $1 AND organisation_id = $2`,
      [webhookId, orgId],
    );

    info("webhook_subscription", {
      message: "Webhook subscription deleted",
      webhookId,
      organisationId: orgId,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete webhook subscription.";
    error("webhook_subscription", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
