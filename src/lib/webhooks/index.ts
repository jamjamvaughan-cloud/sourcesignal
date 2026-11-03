/**
 * Webhook dispatch for SourceSignal (Phase F).
 *
 * Dispatches newly extracted high-value opportunities to user-configured
 * webhook endpoints (Slack, HubSpot, Salesforce, custom). Pro subscribers
 * only. Server-authorised.
 *
 * Dispatches are signed with HMAC-SHA256 using WEBHOOK_SIGNING_SECRET and
 * include timestamp headers for replay protection.
 */

import { query } from "@/lib/db";
import { createHmac } from "crypto";
import { error } from "@/lib/logger";

/**
 * Validates that a URL is safe for outbound dispatch.
 * Blocks private/reserved IP ranges (RFC 1918, link-local, loopback,
 * cloud metadata) and non-http(s) protocols to prevent SSRF.
 */
export function isSafeDispatchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block loopback / localhost.
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }

    // Block link-local / cloud metadata (169.254.0.0/16, including 169.254.169.254).
    if (hostname.startsWith("169.254.")) {
      return false;
    }

    // Block RFC 1918 private IP literals.
    if (hostname.startsWith("10.")) return false;
    if (hostname.startsWith("172.")) {
      const parts = hostname.split(".");
      const second = Number(parts[1]);
      if (!Number.isNaN(second) && second >= 16 && second <= 31) return false;
    }
    if (hostname.startsWith("192.168.")) return false;

    // Block IPv6 link-local and loopback ranges.
    if (hostname.startsWith("fe80:") || hostname.startsWith("::1")) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Dispatches an opportunity webhook to the configured endpoint.
 * Pro users only. Returns dispatch result with status.
 */
export async function dispatchWebhook({
  userId,
  opportunityId,
  webhookUrl,
  eventType = "opportunity.new",
}: {
  userId: string;
  opportunityId: string;
  webhookUrl: string;
  eventType?: string;
}): Promise<{
  dispatched: boolean;
  opportunityId: string;
  webhookUrl: string;
  result: { ok: boolean; status?: number; error?: string };
}> {
  // SSRF guard: reject private/reserved destination addresses.
  if (!isSafeDispatchUrl(webhookUrl)) {
    return {
      dispatched: false,
      opportunityId,
      webhookUrl,
      result: { ok: false, error: "Webhook URL is not allowed." },
    };
  }

  try {
    const result = await query(
      `SELECT id, title, buyer, sector, region, closing_date, estimated_value, currency, source_url
       FROM opportunities WHERE id = $1`,
      [opportunityId],
    );

    if (result.rowCount === 0) {
      return {
        dispatched: false,
        opportunityId,
        webhookUrl,
        result: { ok: false, error: "Opportunity not found" },
      };
    }

    const opportunity = result.rows[0];

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

    const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      return {
        dispatched: false,
        opportunityId,
        webhookUrl,
        result: { ok: false, error: "Webhook signing not configured" },
      };
    }

    const timestamp = Date.now().toString();
    const signature = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex");

    let dispatchResult: { ok: boolean; status?: number; error?: string };
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SourceSignal/1.0",
          ...(signature ? { "X-SourceSignal-Signature": signature } : {}),
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

    // Persist delivery record for audit tracking
    try {
      await query(
        `INSERT INTO webhook_deliveries (id, user_id, opportunity_id, webhook_url, event_type, delivered_at, status, provider, external_id, response_status, error_message)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)`,
        [
          userId,
          opportunityId,
          webhookUrl,
          eventType,
          dispatchResult.ok ? "sent" : "failed",
          "webhook",
          webhookUrl,
          dispatchResult.status ?? null,
          dispatchResult.error ?? null,
        ],
      );
    } catch (err) {
      // Non-fatal: log but don't block response
      error("[webhook] Failed to record delivery", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      dispatched: dispatchResult.ok,
      opportunityId,
      webhookUrl,
      result: dispatchResult,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Dispatch failed.";
    return {
      dispatched: false,
      opportunityId,
      webhookUrl,
      result: { ok: false, error: message },
    };
  }
}

/**
 * Dispatches an opportunity webhook to tier-appropriate endpoints.
 * Pro subscribers only. The dispatch targets are determined by the signal
 * tier of the opportunity.
 */
export async function dispatchWebhookForOpportunity({
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
  webhookUrl: string;
  result: { ok: boolean; status?: number; error?: string };
}> {
  try {
    const result = await query(
      `SELECT id, title, buyer, sector, region, closing_date, estimated_value, currency, source_url, signal_tier
       FROM opportunities WHERE id = $1`,
      [opportunityId],
    );

    if (result.rowCount === 0) {
      return {
        dispatched: false,
        opportunityId,
        webhookUrl: "",
        result: { ok: false, error: "Opportunity not found" },
      };
    }

    const opportunity = result.rows[0];

    // Determine target URL based on signal tier
    const tier = opportunity.signal_tier;

    const targetUrl =
      tier === "MEGAPROCUREMENT"
        ? process.env.WEBHOOK_URL_MEGAPROCUREMENT ||
          process.env.WEBHOOK_URL_PRODUCTION
        : process.env.WEBHOOK_URL_PRODUCTION;

    if (!targetUrl) {
      return {
        dispatched: false,
        opportunityId,
        webhookUrl: "",
        result: { ok: false, error: "Webhook URL not configured" },
      };
    }

    // SSRF guard: reject private/reserved destination addresses.
    if (!isSafeDispatchUrl(targetUrl)) {
      return {
        dispatched: false,
        opportunityId,
        webhookUrl: "",
        result: { ok: false, error: "Webhook URL is not allowed." },
      };
    }

    const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      return {
        dispatched: false,
        opportunityId,
        webhookUrl: targetUrl,
        result: { ok: false, error: "Webhook signing not configured" },
      };
    }

    const timestamp = Date.now().toString();
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
    };
    const signature = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex");

    let dispatchResult: { ok: boolean; status?: number; error?: string };
    try {
      const resp = await fetch(targetUrl, {
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

    try {
      await query(
        `INSERT INTO webhook_deliveries (id, user_id, opportunity_id, webhook_url, event_type, delivered_at, status, provider, external_id, response_status, error_message)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)`,
        [
          userId,
          opportunityId,
          targetUrl,
          eventType,
          dispatchResult.ok ? "sent" : "failed",
          "webhook",
          targetUrl,
          dispatchResult.status ?? null,
          dispatchResult.error ?? null,
        ],
      );
    } catch (err) {
      // Non-fatal: log but don't block response
      error("[webhook] Failed to record delivery", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      dispatched: dispatchResult.ok,
      opportunityId,
      webhookUrl: targetUrl,
      result: dispatchResult,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Dispatch failed.";
    return {
      dispatched: false,
      opportunityId,
      webhookUrl: "",
      result: { ok: false, error: message },
    };
  }
}
