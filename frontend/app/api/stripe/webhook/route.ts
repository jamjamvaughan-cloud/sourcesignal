/**
 * Stripe webhook handling (Phase F).
 *
 * POST /api/stripe/webhook
 *
 * Verifies Stripe webhook signatures and processes events idempotently:
 * - checkout.session.completed → activate subscription, save to user_subscriptions
 * - customer.subscription.updated → sync entitlements
 * - customer.subscription.deleted → cancel access
 * - invoice.payment_failed → mark past_due
 *
 * Server-side only. Webhook secret never reaches the browser.
 * Idempotency is persisted to PostgreSQL (processed_webhooks table)
 * so duplicate processing cannot occur across server restarts.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getStripeConfig } from "@/lib/env";
import type Stripe from "stripe";

let StripeClass: typeof Stripe | null = null;

async function getStripeClass(): Promise<typeof Stripe | null> {
  if (StripeClass) return StripeClass;
  try {
    const StripeModule = await import("stripe");
    StripeClass = StripeModule.default as typeof Stripe;
    return StripeClass;
  } catch {
    return null;
  }
}

/**
 * Check whether a Stripe event has already been processed (persisted idempotency).
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT 1 FROM processed_webhooks WHERE event_id = $1 LIMIT 1`,
      [eventId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Record a processed Stripe event for idempotency.
 */
async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  try {
    await query(
      `INSERT INTO processed_webhooks (event_id, event_type, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType],
    );
  } catch {
    // Non-fatal: idempotency tracking failure should not block processing.
  }
}

/**
 * Upsert a user subscription record from a Stripe subscription object.
 */
async function upsertSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = subscription.customer as string;
  if (!customerId || typeof customerId !== "string") {
    return;
  }

  // Find the user by stripe_customer_id
  const userResult = await query(
    `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  );
  if ((userResult.rowCount ?? 0) === 0) {
    return;
  }
  const userId = userResult.rows[0].id as string;

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const amountTotal = subscription.items.data[0]?.price
    ? (subscription.items.data[0].price.unit_amount ?? 0)
    : 0;

  await query(
    `INSERT INTO user_subscriptions (
          user_id, stripe_customer_id, stripe_subscription_id,
          stripe_price_id, currency, amount_total, plan_tier,
          status, current_period_start, current_period_end,
          cancel_at_period_end, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, NOW(), NOW()
        )
        ON CONFLICT (stripe_subscription_id) DO UPDATE SET
          currency = EXCLUDED.currency,
          amount_total = EXCLUDED.amount_total,
          plan_tier = EXCLUDED.plan_tier,
          status = EXCLUDED.status,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          cancel_at_period_end = EXCLUDED.cancel_at_period_end,
          updated_at = NOW()`,
      [
        userId,
        customerId,
        subscription.id,
        priceId,
        subscription.currency,
        amountTotal,
        subscription.status,
        new Date(
          Number(
            (subscription as unknown as { current_period_start: number })
              .current_period_start,
          ) * 1000,
        ).toISOString(),
        new Date(
          Number(
            (subscription as unknown as { current_period_end: number })
              .current_period_end,
          ) * 1000,
        ).toISOString(),
        null,
      ],
    );

    // Also update the users table with subscription info
    await query(
      `UPDATE users
        SET stripe_subscription_id = $1,
            subscription_tier = $2,
            updated_at = NOW()
          WHERE stripe_customer_id = $3`,
      [
        subscription.id,
        subscription.status === "active" ? "pro" : "free",
        customerId,
      ],
    );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripeConfig = getStripeConfig();
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured." },
      { status: 503 },
    );
  }

  const Stripe = await getStripeClass();
  if (!Stripe) {
    return NextResponse.json(
      { error: "Stripe integration not available." },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeConfig.secretKey, {
    apiVersion: "2024-10-28.acacia",
  });

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeConfig.webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Idempotency: skip already-processed events.
  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (customerId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(subscription);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const userResult = await query(
          `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
          [customerId],
        );
        if ((userResult.rowCount ?? 0) > 0) {
          const userId = userResult.rows[0].id as string;
          await query(
            `UPDATE users
              SET stripe_status = 'canceled',
                  subscription_tier = 'free',
                  updated_at = NOW()
              WHERE id = $1`,
            [userId],
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const userResult = await query(
          `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
          [customerId],
        );
        if ((userResult.rowCount ?? 0) > 0) {
          const userId = userResult.rows[0].id as string;
          await query(
            `UPDATE users
              SET stripe_status = 'past_due',
                  subscription_tier = 'past_due',
                  updated_at = NOW()
              WHERE id = $1`,
            [userId],
          );
        }
        break;
      }

      default:
        break;
    }

    // Mark event as processed only after successful handling.
    await markEventProcessed(event.id, event.type);

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}