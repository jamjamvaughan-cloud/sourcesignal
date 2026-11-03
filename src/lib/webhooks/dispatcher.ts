/**
 * Outbound real-time webhook & alert dispatcher.
 *
 * Runs upon new primary-source signal insertion. Fetches every active,
 * user-registered webhook destination, keeps only those whose sector filters
 * and minimum-value threshold match the incoming signal, then POSTs a signed
 * JSON payload to each. Failed deliveries (HTTP 5xx or network timeout) are
 * retried with exponential backoff. Every attempt is persisted to
 * `alert_logs` for audit.
 *
 * Payload shape:
 *   { event: "signal.created", timestamp: ISO string, signal: {...} }
 *
 * Signature:
 *   X-SourceSignal-Signature = HMAC-SHA256(webhook.secret, JSON.stringify(payload))
 */

import { query } from "../db";
import { createHmac } from "crypto";
import { info, warn } from "@/lib/logger";

/** A user-registered webhook destination. */
export interface WebhookDestination {
  readonly id: string;
  readonly user_id: string;
  readonly url: string;
  readonly secret: string | null;
  readonly sector_filters: string[];
  readonly min_value: number | null;
  readonly is_active: boolean;
}

/** A normalised signal ready for outbound delivery. */
export interface SignalPayload {
  readonly id: string;
  readonly title: string;
  readonly buyer_name: string | null;
  readonly jurisdiction: string | null;
  readonly sector: string | null;
  readonly opportunity_type: string | null;
  readonly estimated_value: number | null;
  readonly source_name: string | null;
  readonly source_url: string | null;
  readonly source_hash: string | null;
  readonly commercial_why: string | null;
  readonly published_at: string | null;
  readonly sha256_hash: string | null;
}

const DEFAULT_MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

/** Sleeps for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter: base * 2^attempt, capped, plus jitter. */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(
    BASE_DELAY_MS * Math.pow(2, attempt),
    MAX_DELAY_MS,
  );
  return exponential + Math.floor(Math.random() * 500);
}

/** True when an HTTP status or network error warrants a retry. */
function isRetryable(status: number | null): boolean {
  return status === null || status >= 500;
}

/** HMAC-SHA256 signature over the canonical JSON payload. */
export function signPayload(secret: string, payload: unknown): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

/** Build the outbound webhook payload for a signal. */
export function buildSignalPayload(signal: SignalPayload): unknown {
  return {
    event: "signal.created",
    timestamp: new Date().toISOString(),
    signal,
  };
}

/** Fetch every active webhook destination. */
export async function fetchActiveWebhooks(): Promise<WebhookDestination[]> {
  const result = await query(
    `SELECT id, user_id, url, secret, sector_filters, min_value, is_active
       FROM webhooks
      WHERE is_active = TRUE
      ORDER BY created_at ASC`,
  );

  return (result.rows ?? []).map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    url: row.url as string,
    secret: (row.secret as string | null) ?? null,
    sector_filters: Array.isArray(row.sector_filters)
      ? (row.sector_filters as string[])
      : [],
    min_value:
      row.min_value === null || row.min_value === undefined
        ? null
        : Number(row.min_value),
    is_active: Boolean(row.is_active),
  }));
}

/** True when the signal matches the webhook's sector and value filters. */
export function matchesFilters(
  webhook: WebhookDestination,
  signal: SignalPayload,
): boolean {
  // Sector filter: empty means "all sectors"; otherwise signal's sector must
  // be present in the webhook's sector_filters list.
  if (
    webhook.sector_filters.length > 0 &&
    signal.sector &&
    !webhook.sector_filters.includes(signal.sector)
  ) {
    return false;
  }

  // Minimum value filter: skip signals below the threshold (when disclosed).
  if (
    webhook.min_value !== null &&
    signal.estimated_value !== null &&
    Number(signal.estimated_value) < webhook.min_value
  ) {
    return false;
  }

  return true;
}

/** Persist a single delivery attempt to alert_logs. */
export async function logDelivery({
  webhookId,
  signalId,
  status,
  responseStatusCode,
}: {
  webhookId: string;
  signalId?: string | null;
  status: string;
  responseStatusCode?: number | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO alert_logs (
            webhook_id, signal_id, status, response_status_code, attempted_at
          )
          VALUES ($1, $2, $3, $4, NOW())`,
      [webhookId, signalId ?? null, status, responseStatusCode ?? null],
    );
  } catch (err) {
    warn("Failed to persist alert log", {
      webhookId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Deliver a signed payload to a single webhook with exponential backoff on
 * retryable failures (HTTP 5xx or network timeout). Returns the final status
 * and HTTP status code.
 */
export async function deliverWithRetry(
  webhook: WebhookDestination,
  payload: unknown,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<{ status: "sent" | "failed"; statusCode: number | null }> {
  const payloadStr = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SourceSignal/1.0 (+https://sourcesignal.site)",
  };

  if (webhook.secret) {
    headers["X-SourceSignal-Signature"] = signPayload(webhook.secret, payload);
  }

  let lastStatus: number | null = null;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadStr,
        // Fail fast on hang; retryable timeouts trigger backoff.
        signal: AbortSignal.timeout(15_000),
      });

      lastStatus = response.status;

      if (response.ok) {
        info("webhook_delivery", {
          message: "Webhook delivered",
          webhookId: webhook.id,
          url: webhook.url,
          status: response.status,
          attempt,
        });
        return { status: "sent", statusCode: response.status };
      }

      // Retryable server errors are retried; client errors are not.
      if (!isRetryable(response.status)) {
        lastError = `HTTP ${response.status}`;
        break;
      }

      lastError = `HTTP ${response.status}`;
      warn("webhook_delivery_retry", {
        message: "Webhook delivery retryable failure",
        webhookId: webhook.id,
        url: webhook.url,
        status: response.status,
        attempt,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      warn("webhook_delivery_error", {
        message: "Webhook delivery error",
        webhookId: webhook.id,
        url: webhook.url,
        error: lastError,
        attempt,
      });
    }

    if (attempt < maxRetries) {
      await sleep(backoffDelay(attempt));
    }
  }

  return { status: "failed", statusCode: lastStatus ?? null };
}

/**
 * Dispatch a newly inserted signal to every matching active webhook
 * destination. Returns per-webhook results. Delivery is fire-and-forget with
 * respect to the caller: failures are logged to alert_logs but never thrown.
 */
export async function dispatchSignal(
  signal: SignalPayload,
): Promise<Array<{ webhookId: string; status: string; statusCode: number | null }>> {
  const webhooks = await fetchActiveWebhooks();
  const payload = buildSignalPayload(signal);

  const results: Array<{
    webhookId: string;
    status: string;
    statusCode: number | null;
  }> = [];

  for (const webhook of webhooks) {
    if (!matchesFilters(webhook, signal)) {
      continue;
    }

    const result = await deliverWithRetry(webhook, payload);

    await logDelivery({
      webhookId: webhook.id,
      signalId: signal.id,
      status: result.status,
      responseStatusCode: result.statusCode,
    });

    results.push({
      webhookId: webhook.id,
      status: result.status,
      statusCode: result.statusCode,
    });
  }

  info("signal_dispatched", {
    signalId: signal.id,
    webhooksNotified: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
  });

  return results;
}
