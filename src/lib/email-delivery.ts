/**
 * Email delivery abstraction (Phase G).
 *
 * Provides a pluggable email delivery provider interface and a persistent
 * delivery log backed by the PostgreSQL `alert_deliveries` table. Deliveries
 * survive restarts instead of living in volatile process memory.
 *
 * When no email provider is configured, deliveries are persisted with status
 * "queued" so the feature can be completed without rewriting the system.
 *
 * Never claims an alert was delivered if it was only queued.
 */

import { query } from "@/lib/db";
import { error } from "@/lib/logger";

export interface EmailProvider {
  readonly name: string;
  send(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ accepted: boolean; messageId?: string; error?: string }>;
}

export interface QueuedDelivery {
  id: string;
  alertId: string;
  opportunityId: string;
  to: string;
  status: "queued" | "sent" | "failed";
  provider: string;
  messageId?: string;
  error?: string;
  createdAt: string;
  sentAt?: string;
}

/**
 * Persists a delivery record to `alert_deliveries`.
 *
 * Failures are logged but never thrown: alert processing should continue even
 * when the audit log cannot be written.
 */
async function persistDelivery(delivery: QueuedDelivery): Promise<void> {
  try {
    await query(
      `INSERT INTO alert_deliveries
         (alert_id, opportunity_id, status, provider, external_id,
          error_message, delivered_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        delivery.alertId,
        delivery.opportunityId,
        delivery.status,
        delivery.provider,
        delivery.messageId ?? null,
        delivery.error ?? null,
        delivery.status === "sent"
          ? delivery.sentAt ?? delivery.createdAt
          : null,
      ],
    );
  } catch (err: unknown) {
    error("alert_delivery_persist_failed", {
      alertId: delivery.alertId,
      opportunityId: delivery.opportunityId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
  }
}

/** Returns recent deliveries (for testing and administration). */
export async function getDeliveryQueue(): Promise<QueuedDelivery[]> {
  try {
    const result = await query(
      `SELECT d.id,
              d.alert_id,
              d.opportunity_id,
              u.email AS recipient,
              d.status,
              d.provider,
              d.external_id,
              d.error_message,
              d.delivered_at,
              d.created_at
         FROM alert_deliveries d
         LEFT JOIN alerts a ON a.id = d.alert_id
         LEFT JOIN users u ON u.id = a.user_id
        ORDER BY d.created_at DESC
        LIMIT 500`,
    );

    return result.rows.map((row) => ({
      id: row.id as string,
      alertId: row.alert_id as string,
      opportunityId: row.opportunity_id as string,
      to: (row.recipient as string | null) ?? "",
      status: row.status as QueuedDelivery["status"],
      provider: (row.provider as string | null) ?? "none",
      ...(row.external_id ? { messageId: row.external_id as string } : {}),
      ...(row.error_message ? { error: row.error_message as string } : {}),
      createdAt: new Date(row.created_at as string).toISOString(),
      ...(row.delivered_at
        ? { sentAt: new Date(row.delivered_at as string).toISOString() }
        : {}),
    }));
  } catch (err: unknown) {
    error("alert_delivery_queue_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Resets the delivery log. For testing only.
 */
export async function resetDeliveryQueue(): Promise<void> {
  try {
    await query(`DELETE FROM alert_deliveries`);
  } catch (err: unknown) {
    error("alert_delivery_reset_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Abstract email delivery service. Tries the configured provider; if none is
 * configured, records the delivery as "queued" with status honesty.
 */
export class EmailDeliveryService {
  private provider: EmailProvider | null;

  constructor(provider: EmailProvider | null = null) {
    this.provider = provider;
  }

  async sendAlert({
    alertId,
    opportunityId,
    to,
    subject,
    text,
    html,
  }: {
    alertId: string;
    opportunityId: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ status: "sent" | "queued"; messageId?: string; error?: string }> {
    const id = `dlv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const createdAt = new Date().toISOString();

    if (this.provider) {
      try {
        const result = await this.provider.send({ to, subject, text, html });
        const entry: QueuedDelivery = {
          id,
          alertId,
          opportunityId,
          to,
          status: result.accepted ? "sent" : "failed",
          provider: this.provider.name,
          messageId: result.messageId,
          error: result.error,
          createdAt,
          ...(result.accepted ? { sentAt: createdAt } : {}),
        };
        await persistDelivery(entry);
        return {
          status: result.accepted ? "sent" : "queued",
          messageId: result.messageId,
          error: result.error,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const entry: QueuedDelivery = {
          id,
          alertId,
          opportunityId,
          to,
          status: "failed",
          provider: this.provider.name,
          error: message,
          createdAt,
        };
        await persistDelivery(entry);
        return { status: "queued", error: message };
      }
    }

    // No provider configured — record as queued, never claim delivery.
    const entry: QueuedDelivery = {
      id,
      alertId,
      opportunityId,
      to,
      status: "queued",
      provider: "none",
      createdAt,
    };
    await persistDelivery(entry);
    return { status: "queued" };
  }
}

/**
 * Default email delivery service instance. No provider is configured by
 * default; set one via environment or dependency injection.
 */
export const emailDelivery = new EmailDeliveryService();
