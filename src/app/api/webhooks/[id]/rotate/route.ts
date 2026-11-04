/**
 * Rotate webhook secret.
 *
 * POST /api/webhooks/[id]/rotate
 *
 * Rotates the HMAC signing secret for a registered webhook destination.
 * Requires an authenticated session and ownership of the destination.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { query } from "@/lib/db";
import { rotateWebhookSecret } from "@/lib/webhooks/dispatcher";
import { info, error } from "@/lib/logger";

async function requireOwner(
  request: NextRequest,
  webhookId: string,
): Promise<{ userId: string } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Outbound webhooks are part of the Pro/Enterprise alerting feature.
  const planId = await getUserPlanId(user.id);
  if (!entitlementsFor(planId).alertsEnabled) {
    return NextResponse.json(
      { error: "Webhooks require a Pro subscription." },
      { status: 403 },
    );
  }

  const result = await query(
    `SELECT id FROM webhooks WHERE id = $1 AND user_id = $2`,
    [webhookId, user.id],
  );
  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return { userId: user.id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: webhookId } = await params;
  const result = await requireOwner(request, webhookId);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = await request.json().catch(() => ({}));
  const { secret } = body;

  if (!secret || typeof secret !== "string" || secret.length < 8) {
    return NextResponse.json(
      { error: "Secret must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    await rotateWebhookSecret(webhookId, secret);

    info("webhook_secret_rotated", {
      message: "Webhook secret rotated",
      webhookId,
      userId,
    });

    return NextResponse.json({
      ok: true,
      message: "Secret rotated successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to rotate secret.";
    error("webhook_secret_rotate", { error: message, webhookId, userId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
