/**
 * Webhook Dispatch API (Phase F).
 *
 * POST /api/webhooks/dispatch
 *
 * Dispatches newly extracted high-value opportunities to user-configured
 * webhook endpoints (Slack, HubSpot, Salesforce, custom). Pro subscribers
 * only. Server-authorised.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { entitlementsFor } from "@/lib/entitlements";
import type { PlanId } from "@/lib/entitlements";
import { error } from "@/lib/logger";
import { isSafeDispatchUrl } from "@/lib/webhooks";

async function requirePro(
  request: NextRequest,
): Promise<{
  userId: string;
  entitlements: ReturnType<typeof entitlementsFor>;
} | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = "pro" as PlanId;
  const entitlements = entitlementsFor(planId);
  if (!entitlements.exportsEnabled) {
    return NextResponse.json(
      { error: "Webhook dispatch requires a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id, entitlements };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = await requirePro(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = await request.json().catch(() => ({}));
  const { opportunityId, webhookUrl, eventType = "opportunity.new" } = body;

  if (!opportunityId || !webhookUrl) {
    return NextResponse.json(
      { error: "opportunityId and webhookUrl are required." },
      { status: 400 },
    );
  }

  // Validate webhook URL format.
  try {
    new URL(webhookUrl);
  } catch {
    return NextResponse.json({ error: "Invalid webhook URL." }, { status: 400 });
  }

  // SSRF guard: reject private/reserved destination addresses.
  if (!isSafeDispatchUrl(webhookUrl)) {
    return NextResponse.json({ error: "Webhook URL is not allowed." }, { status: 400 });
  }

  const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Webhook signing not configured." },
      { status: 503 },
    );
  }

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    // Fetch the opportunity to dispatch.
    const opportunity = await pb.collection("opportunities").getOne(opportunityId, {
      fields: "id,title,buyer,sector,region,closing_date,estimated_value,currency,source_url",
    });

    const payload = {
      event: eventType,
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        buyer: opportunity.buyer,
        sector: opportunity.sector,
        region: opportunity.region,
        closing_date: opportunity.closing_date,
        estimated_value: opportunity.estimated_value,
        currency: opportunity.currency,
        source_url: opportunity.source_url,
      },
      timestamp: new Date().toISOString(),
    };

    const timestamp = Date.now().toString();
    const signature = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex");

    // Dispatch webhook.
    let dispatchResult: { ok: boolean; status?: number; error?: string };
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SourceSignal/1.0",
          "X-SourceSignal-Signature": signature,
          "X-SourceSignal-Timestamp": timestamp,
        },
        body: JSON.stringify(payload),
      });
      dispatchResult = {
        ok: resp.ok,
        status: resp.status,
      };
    } catch (err: unknown) {
      dispatchResult = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Log delivery to PocketBase for audit tracking.
    try {
      await pb.collection("webhook_deliveries").create({
        user: userId,
        opportunity: opportunityId,
        webhook_url: webhookUrl,
        event_type: eventType,
        delivered_at: new Date().toISOString(),
        status: dispatchResult.ok ? "sent" : "failed",
        provider: "webhook",
        external_id: webhookUrl,
        response_status: dispatchResult.status ?? null,
        error_message: dispatchResult.error ?? null,
      });
    } catch (err) {
      // Non-fatal: log but don't block the response.
      error("[webhook] Failed to record delivery", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({
      dispatched: dispatchResult.ok,
      opportunityId,
      webhookUrl,
      result: dispatchResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Dispatch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
