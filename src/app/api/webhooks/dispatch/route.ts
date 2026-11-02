/**
 * Webhook Dispatch API (Phase F).
 *
 * POST /api/webhooks/dispatch
 *
 * Dispatches newly extracted high-value opportunities to user-configured
 * webhook endpoints (Slack, Teams, Zapier, custom). Pro subscribers only.
 * Server-authorised and SSRF-guarded.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { error } from "@/lib/logger";
import { isSafeDispatchUrl } from "@/lib/webhooks";

async function requirePro(
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

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const opportunityId = body.opportunityId;
  const webhookUrl = body.webhookUrl;
  const eventType =
    typeof body.eventType === "string" ? body.eventType : "opportunity.new";

  if (typeof opportunityId !== "string" || typeof webhookUrl !== "string") {
    return NextResponse.json(
      { error: "opportunityId and webhookUrl are required." },
      { status: 400 },
    );
  }

  // Validate webhook URL format.
  try {
    new URL(webhookUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook URL." },
      { status: 400 },
    );
  }

  // SSRF guard: reject private/reserved destination addresses.
  if (!isSafeDispatchUrl(webhookUrl)) {
    return NextResponse.json(
      { error: "Webhook URL is not allowed." },
      { status: 400 },
    );
  }

  const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Webhook signing not configured." },
      { status: 503 },
    );
  }

  try {
    // Fetch the opportunity to dispatch.
    const opportunityResult = await query(
      `SELECT id, title, buyer, sector, region, closing_date,
              estimated_value, currency, source_url
         FROM opportunities
        WHERE id = $1`,
      [opportunityId],
    );

    if ((opportunityResult.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    const opportunity = opportunityResult.rows[0];

    const payload = {
      event: eventType,
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        buyer: opportunity.buyer,
        sector: opportunity.sector,
        region: opportunity.region,
        closing_date: opportunity.closing_date,
        estimated_value:
          opportunity.estimated_value != null
            ? Number(opportunity.estimated_value)
            : null,
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

    // Record delivery for audit tracking (non-fatal).
    try {
      await query(
        `INSERT INTO webhook_deliveries
           (user_id, opportunity_id, webhook_url, event_type, payload,
            provider, external_id, response_status, error_message,
            status, delivered_at, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'webhook', $6, $7, $8, $9, NOW(), NOW())`,
        [
          userId,
          opportunityId,
          webhookUrl,
          eventType,
          JSON.stringify(payload),
          webhookUrl,
          dispatchResult.status ?? null,
          dispatchResult.error ?? null,
          dispatchResult.ok ? "sent" : "failed",
        ],
      );
    } catch (err: unknown) {
      error("webhook_delivery_record_failed", {
        userId,
        opportunityId,
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
    error("webhook_dispatch_failed", {
      userId,
      opportunityId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to dispatch the webhook." },
      { status: 500 },
    );
  }
}
