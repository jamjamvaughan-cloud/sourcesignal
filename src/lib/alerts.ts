/**
 * Alert dispatch for SourceSignal (Phase G).
 *
 * Dispatches alerts to Pro subscribers based on tiered signal configuration.
 * Server-authorised.
 */

import { createHmac } from "crypto";
import { query } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { type PlanId } from "@/lib/entitlements";
import { error } from "@/lib/logger";

/**
 * Dispatches an alert to a user via all configured channels.
 * Pro subscribers only.
 */
export async function dispatchAlert({
  userId,
  opportunityId,
  eventType = "opportunity.new",
}: {
  userId: string;
  opportunityId: string;
  eventType?: string;
}): Promise<{
  dispatched: boolean;
  opportunityId: string;
  result: { ok: boolean; status?: number; error?: string };
}> {
  try {
    // Fetch the opportunity details
    const existingResult = await query(
      `SELECT id, title, buyer_name AS buyer, sector::text AS sector,
              jurisdiction AS region, NULL::timestamptz AS closing_date,
              estimated_value,
              CASE jurisdiction
                WHEN 'US' THEN 'USD'
                WHEN 'EU' THEN 'EUR'
                ELSE 'GBP'
              END AS currency,
              source_url
       FROM signals WHERE id = $1`,
      [opportunityId],
    );

    if (existingResult.rowCount === 0) {
      return {
        dispatched: false,
        opportunityId,
        result: { ok: false, error: "Opportunity not found" },
      };
    }

    const opportunity = existingResult.rows[0]!;

    // Get user's entitlements
    const planId = await getUserPlanId(userId);
    const entitlements = entitlementsFor(planId as PlanId);

    if (!entitlements.alertsEnabled) {
      return {
        dispatched: false,
        opportunityId,
        result: { ok: false, error: "Alerts require Pro subscription" },
      };
    }

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

    // Dispatch via webhook if configured
    const webhookUrl = process.env.WEBHOOK_URL_PRODUCTION;
    let dispatchResult: { ok: boolean; status?: number; error?: string };

    if (webhookUrl) {
      const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
      if (!signingSecret) {
        return {
          dispatched: false,
          opportunityId,
          result: { ok: false, error: "Webhook signing not configured" },
        };
      }
      const timestamp = Date.now().toString();
      const signature = createHmac("sha256", signingSecret)
        .update(`${timestamp}.${JSON.stringify(payload)}`)
        .digest("hex");

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
    } else {
      dispatchResult = { ok: false, error: "No webhook URL configured" };
    }

    // Record delivery
    try {
      await query(
        `INSERT INTO alert_deliveries (id, opportunity_id, delivered_at, status, provider, external_id, response_status, error_message)
         VALUES (gen_random_uuid(), $1, NOW(), $2, $3, $4, $5, $6)`,
        [opportunityId, dispatchResult.ok ? "sent" : "failed", "webhook", webhookUrl ?? "", dispatchResult.status ?? null, dispatchResult.error ?? null],
      );
    } catch (err: unknown) {
      error("alert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      dispatched: dispatchResult.ok,
      opportunityId,
      result: dispatchResult,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Alert dispatch failed.";
    return {
      dispatched: false,
      opportunityId,
      result: { ok: false, error: message },
    };
  }
}

/**
 * Get user plan ID from PostgreSQL.
 */
async function getUserPlanId(userId: string): Promise<PlanId> {
  try {
    const result = await query(
      `SELECT u.subscription_tier
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN organisations o ON o.id = m.organisation_id
       WHERE u.id = $1`,
      [userId],
    );
    if (result.rowCount === 0) return "free";
    return (result.rows[0].subscription_tier as PlanId) ?? "free";
  } catch {
    return "free";
  }
}
