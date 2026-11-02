"use server";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { redis } from "@/lib/redis";
import { error, info } from "@/lib/logger";

/**
 * Stripe Webhook Receiver.
 *
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events for subscription lifecycle management:
 *   - checkout.session.completed  → Upgrade user to Pro
 *   - customer.subscription.updated → Downgrade to free if canceled/past_due
 *   - customer.subscription.deleted → Revert user to free tier
 *
 * Verifies HMAC-SHA256 signature using STRIPE_WEBHOOK_SECRET.
 * Records processed event IDs in `processed_webhooks` to prevent duplicate
 * processing.
 * Invalidates user session cache in Redis immediately so browsers see tier
 * changes without re-login.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Secrets are read at request time, not module load: `next build` evaluates
  // route modules without runtime credentials.
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    error("stripe_webhook", { error: "Stripe webhook is not configured" });
    return NextResponse.json(
      { error: "Stripe webhook not configured." },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-10-28.endive",
  });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    error("stripe_webhook", { error: "Missing stripe-signature header" });
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify HMAC-SHA256 signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error("stripe_webhook", { error: `Signature verification failed: ${message}` });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: check if this event was already processed
  let existingRowCount = 0;
  try {
    const existing = await query(
      `SELECT id FROM processed_webhooks WHERE event_id = $1`,
      [event.id],
    );
    existingRowCount = existing.rowCount ?? 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error("stripe_webhook", { error: `Duplicate check failed: ${message}`, eventId: event.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (existingRowCount > 0) {
    info("stripe_webhook", { eventId: event.id, type: event.type, status: "duplicate_skipped" });
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        // Unhandled event type - log but acknowledge
        info("stripe_webhook", { eventId: event.id, type: event.type, status: "unhandled" });
        break;
    }

    // Record the event as processed
    await query(
      `INSERT INTO processed_webhooks (event_id, event_type, processed_at)
       VALUES ($1, $2, NOW())`,
      [event.id, event.type],
    );

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error("stripe_webhook", {
      error: message,
      eventId: event.id,
      type: event.type,
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed - upgrade user to Pro tier.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription as string;

  if (!customerEmail) {
    error("stripe_webhook", {
      error: "checkout.session.completed missing customer email",
      sessionId: session.id,
    });
    return;
  }

  if (!subscriptionId) {
    error("stripe_webhook", {
      error: "checkout.session.completed missing subscription ID",
      sessionId: session.id,
    });
    return;
  }

  try {
    const result = await query(
      `UPDATE users
       SET subscription_tier = 'pro',
            stripe_customer_id = $1,
            stripe_subscription_id = $2,
            updated_at = NOW()
       WHERE email = $3
       RETURNING id, email, subscription_tier`,
      [session.customer as string, subscriptionId, customerEmail],
    );

    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      error("stripe_webhook", {
        error: "No user found with email",
        email: customerEmail,
        sessionId: session.id,
      });
      return;
    }

    // Invalidate Redis session cache for this user so browser sees Pro immediately
    await invalidateUserSession(customerEmail);

    info("stripe_webhook", {
      eventType: "checkout.session.completed",
      userId: result.rows[0].id,
      email: result.rows[0].email,
      subscriptionId,
      newTier: "pro",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error("stripe_webhook", {
      error: `Failed to upgrade user: ${message}`,
      email: customerEmail,
      sessionId: session.id,
    });
    throw err;
  }
}

/**
 * Handle customer.subscription.updated - downgrade to free if canceled/past_due.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
  const status = subscription.status;

  if (status !== "canceled" && status !== "past_due") {
    return; // Only downgrade on cancel/past_due
  }

  try {
    const result = await query(
      `UPDATE users
       SET subscription_tier = 'free',
            stripe_subscription_id = NULL,
            updated_at = NOW()
       WHERE stripe_customer_id = $1
       RETURNING id, email, subscription_tier`,
      [customerId],
    );

    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      error("stripe_webhook", {
        error: "No user found with customer ID",
        customerId,
        subscriptionId: subscription.id,
      });
      return;
    }

    // Invalidate Redis session cache for this user
    await invalidateUserSession(result.rows[0].email);

    info("stripe_webhook", {
      eventType: "customer.subscription.updated",
      userId: result.rows[0].id,
      email: result.rows[0].email,
      customerId,
      subscriptionId: subscription.id,
      newTier: "free",
      reason: status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error("stripe_webhook", {
      error: `Failed to downgrade user: ${message}`,
      customerId,
      subscriptionId: subscription.id,
    });
    throw err;
  }
}

/**
 * Handle customer.subscription.deleted - revert to free tier.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  try {
    const result = await query(
      `UPDATE users
       SET subscription_tier = 'free',
            stripe_subscription_id = NULL,
            updated_at = NOW()
       WHERE stripe_customer_id = $1
       RETURNING id, email, subscription_tier`,
      [customerId],
    );

    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      error("stripe_webhook", {
        error: "No user found with customer ID",
        customerId,
        subscriptionId: subscription.id,
      });
      return;
    }

    // Invalidate Redis session cache for this user
    await invalidateUserSession(result.rows[0].email);

    info("stripe_webhook", {
      eventType: "customer.subscription.deleted",
      userId: result.rows[0].id,
      email: result.rows[0].email,
      customerId,
      subscriptionId: subscription.id,
      newTier: "free",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error("stripe_webhook", {
      error: `Failed to delete user subscription: ${message}`,
      customerId,
      subscriptionId: subscription.id,
    });
    throw err;
  }
}

/**
 * Invalidate all Redis session cache entries for a user so their browser
 * sees the updated tier without re-login.
 */
async function invalidateUserSession(email: string): Promise<void> {
  try {
    // Invalidate any cached user profile data
    await redis.del(`user:${email}`);
    await redis.del(`userProfile:${email}`);

    // Find and invalidate any session keys associated with this email
    const sessionKeys = await redis.keys("session:*");
    for (const key of sessionKeys) {
      const sessionData = await redis.get(key);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          if (parsed.userId) {
            const userCheck = await query(
              `SELECT email FROM users WHERE id = $1`,
              [parsed.userId],
            );
            const userRowCount = userCheck.rowCount ?? 0;
            if (userRowCount > 0 && userCheck.rows[0].email === email) {
              await redis.del(key);
            }
          }
        } catch {
          // Ignore parse errors on non-session keys
        }
      }
    }
  } catch (err) {
    // Non-fatal: session invalidation is best-effort
    error("stripe_webhook", {
      error: `Session invalidation failed: ${err instanceof Error ? err.message : String(err)}`,
      email,
    });
  }
}
