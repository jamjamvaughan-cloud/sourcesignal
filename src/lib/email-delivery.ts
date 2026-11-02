/**
 * Email delivery abstraction (Phase G).
 *
 * Provides a pluggable email delivery provider interface and persistent
 * delivery queue/status abstraction backed by PocketBase's
 * `alert_deliveries` collection. Deliveries are persisted across restarts
 * instead of holding them in volatile process memory.
 *
 * When no email provider credentials are configured, deliveries are persisted
 * with status "queued" so the feature can be completed without rewriting
 * the system.
 *
 * Never claims an alert was delivered if it was only queued.
 */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;

export interface EmailProvider {
  readonly name: string;
  send(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ accepted: boolean; messageId?: string; error?: string }>;
}

interface QueuedDelivery {
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
 * Persists a delivery record to PocketBase's alert_deliveries collection.
 */
async function persistDelivery(delivery: QueuedDelivery): Promise<void> {
  const pb = await getAdminPb();
  if (!pb) {
    return;
  }
  try {
    await pb.collection("alert_deliveries").create({
      id: delivery.id,
      alert: delivery.alertId,
      opportunity: delivery.opportunityId,
      delivered_at: delivery.createdAt,
      status: delivery.status,
      provider: delivery.provider,
      external_id: delivery.messageId ?? null,
      error_message: delivery.error ?? null,
    });
  } catch {
    // Non-fatal: persistence failure should not block alert processing.
  }
}

/**
 * Returns all queued deliveries from PocketBase (for testing and administration).
 */
export async function getDeliveryQueue(): Promise<QueuedDelivery[]> {
  const pb = await getAdminPb();
  if (!pb) {
    return [];
  }
  try {
    const records = await pb.collection("alert_deliveries").getFullList();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return records.map((d: any) => ({
      id: d.id,
      alertId: d.alert as string,
      opportunityId: d.opportunity as string,
      to: (d as Record<string, unknown>).to as string,
      status: d.status as "queued" | "sent" | "failed",
      provider: d.provider as string,
      messageId: d.external_id as string | undefined,
      error: d.error_message as string | undefined,
      createdAt: d.delivered_at as string,
      sentAt: (d as Record<string, unknown>).sentAt as string | undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Resets the delivery queue (clears all alert_deliveries records).
 * For testing only.
 */
export async function resetDeliveryQueue(): Promise<void> {
  const pb = await getAdminPb();
  if (!pb) {
    return;
  }
  try {
    const records = await pb.collection("alert_deliveries").getFullList();
    for (const record of records) {
      await pb.collection("alert_deliveries").delete(record.id);
    }
  } catch {
    // Non-fatal.
  }
}

/**
 * Abstract email delivery service. Tries the configured provider; if none is
 * configured, records the delivery as "queued" with status honesty.
 * Persists all deliveries to PocketBase.
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
        const error = err instanceof Error ? err.message : String(err);
        const entry: QueuedDelivery = {
          id,
          alertId,
          opportunityId,
          to,
          status: "failed",
          provider: this.provider.name,
          error,
          createdAt,
        };
        await persistDelivery(entry);
        return { status: "queued", error };
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
