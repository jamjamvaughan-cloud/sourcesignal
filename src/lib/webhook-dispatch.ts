/**
 * Webhook Dispatch Utility (Zero CRM Bloat & Frictionless Hand-Off).
 *
 * Dispatches high-intent signals to registered webhook URLs so users can
 * stream signals directly to Slack, Teams, Zapier, Make, or their own
 * tech stack. No CRM lock-in — data flows out via standard webhooks.
 *
 * Delivery attempts are persisted to webhook_delivery_logs for auditing
 * and retry. Failed deliveries are tracked per subscription.
 */

import { createHmac } from "crypto";
import { query } from "@/lib/db";
import { error, info } from "@/lib/logger";
import { getAppUrl } from "@/lib/url";

export interface WebhookDispatchPayload {
  type: "opportunity.created";
  id: string;
  canonical_id: string;
  title: string;
  sector?: string | null;
  region?: string | null;
  country?: string | null;
  buyer?: string | null;
  estimated_value?: number | null;
  currency?: string | null;
  signal_tier?: string | null;
  confidence?: number | null;
  source_url?: string | null;
  source_name?: string | null;
  displacement_probability?: number | null;
  primary_driver?: string | null;
  created_at: string;
  source_app_url?: string | null;
}

/**
 * Tier rank for filtering webhooks by min_tier.
 */
const TIER_RANK: Record<string, number> = {
  STANDARD_COMMERCIAL: 1,
  HIGH_CAP: 2,
  MEGAPROCUREMENT: 3,
};

/**
 * Dispatch a signal to all active webhook subscriptions for an organisation
 * that match the signal's tier and confidence thresholds.
 *
 * @param organisationId - The organisation whose webhooks to notify.
 * @param payload - The signal payload to deliver.
 */
export async function dispatchToWebhooks(
  organisationId: string,
  payload: WebhookDispatchPayload,
): Promise<void> {
  // Fetch active webhook subscriptions for this organisation.
  const subs = await query(
    `SELECT id, url, secret, event_types, min_tier, min_confidence
       FROM webhook_subscriptions
      WHERE organisation_id = $1 AND is_active = TRUE`,
    [organisationId],
  );

  if ((subs.rowCount ?? 0) === 0) {
    return; // No subscriptions — nothing to do.
  }

  const appUrl = getAppUrl();

  const payloadStr = JSON.stringify({
    ...payload,
    source_app_url: `${appUrl}/dashboard?signal=${payload.id}`,
  });

  for (const sub of subs.rows as Array<{
    id: string;
    url: string;
    secret?: string | null;
    event_types?: string | unknown;
    min_tier?: string | null;
    min_confidence?: number | null;
  }>) {
    // Check event type filter.
    const eventTypes: string[] =
      typeof sub.event_types === "string"
        ? JSON.parse(sub.event_types)
        : Array.isArray(sub.event_types)
          ? sub.event_types
          : ["opportunity.created"];
    if (!eventTypes.includes(payload.type)) {
      continue;
    }

    // Check min tier filter.
    const subMinTier = sub.min_tier ?? "STANDARD_COMMERCIAL";
    const payloadTier = payload.signal_tier ?? "STANDARD_COMMERCIAL";
    if ((TIER_RANK[payloadTier] ?? 1) < (TIER_RANK[subMinTier] ?? 1)) {
      continue;
    }

    // Check min confidence filter.
    const subMinConf = sub.min_confidence ?? 0;
    const payloadConf = payload.confidence ?? 0;
    if (payloadConf < subMinConf) {
      continue;
    }

    // Compute HMAC signature if secret is configured.
    let signature: string | undefined;
    if (sub.secret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureStr = `${timestamp}.${payloadStr}`;
      const sig = createHmac("sha256", sub.secret)
        .update(signatureStr)
        .digest("hex");
      signature = `t=${timestamp},v1=${sig}`;
    }

    // Dispatch.
    const start = Date.now();
    let httpStatus: number | undefined;
    let errorMessage: string | undefined;
    let status = "pending";

    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SourceSignal/1.0",
          ...(signature ? { "X-SourceSignal-Signature": signature } : {}),
        },
        body: payloadStr,
      });
      httpStatus = res.status;
      if (res.ok) {
        status = "sent";
        info("webhook_dispatch", {
          message: "Webhook delivered",
          subscriptionId: sub.id,
          url: sub.url,
          status: res.status,
          latencyMs: Date.now() - start,
        });
      } else {
        status = "failed";
        errorMessage = `HTTP ${res.status}`;
        error("webhook_dispatch", {
          message: "Webhook delivery failed",
          subscriptionId: sub.id,
          url: sub.url,
          status: res.status,
          latencyMs: Date.now() - start,
        });
      }
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      error("webhook_dispatch", {
        message: "Webhook delivery error",
        subscriptionId: sub.id,
        url: sub.url,
        error: errorMessage,
        latencyMs: Date.now() - start,
      });
    }

    // Persist delivery log.
    try {
      await query(
        `INSERT INTO webhook_delivery_logs (
              webhook_subscription_id, opportunity_id, status,
              http_status, error_message, sent_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())`,
        [sub.id, payload.id, status, httpStatus, errorMessage],
      );

      // Update subscription delivery counters.
      if (status === "sent") {
        await query(
          `UPDATE webhook_subscriptions
                SET total_deliveries = total_deliveries + 1,
                    last_delivery_at = NOW(),
                    updated_at = NOW()
              WHERE id = $1`,
          [sub.id],
        );
      } else {
        await query(
          `UPDATE webhook_subscriptions
                SET failed_deliveries = failed_deliveries + 1,
                    updated_at = NOW()
              WHERE id = $1`,
          [sub.id],
        );
      }
    } catch {
      // Non-fatal: delivery log failure should not block the dispatch loop.
    }
  }
}
