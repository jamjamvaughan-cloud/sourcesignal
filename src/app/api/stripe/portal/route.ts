/**
 * Stripe Customer Portal session creation (Phase F).
 *
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription (update payment method, cancel, view invoices).
 * Server-side only. Redirects back to the app's billing page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getStripeConfig } from "@/lib/env";
import { getAppUrl } from "@/lib/url";
import type Stripe from "stripe";

async function requireUser(
  request: NextRequest,
): Promise<{ id: string; email: string } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return { id: user.id, email: user.email };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId, email } = userOrError;

  const stripeConfig = getStripeConfig();
  if (!stripeConfig.secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  // Dynamically import Stripe so the module is only loaded when Stripe is used.
  const StripeModule = await import("stripe");
  const StripeClass = StripeModule.default as typeof Stripe;

  const stripe = new StripeClass(stripeConfig.secretKey, {
    apiVersion: "2026-09-30.endive",
  });

  try {
    // Find the user's organisation membership and Stripe customer ID.
    const orgResult = await query(
      `SELECT o.id, o.stripe_customer_id
       FROM organisations o
       JOIN memberships m ON m.organisation_id = o.id
       WHERE m.user_id = $1
       LIMIT 1`,
      [userId],
    );

    if ((orgResult.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "No organisation found for user." },
        { status: 400 },
      );
    }

    const org = orgResult.rows[0];
    const orgId = org.id as string;
    let customerId = (org.stripe_customer_id as string | undefined);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          organisationId: orgId,
          userId,
        },
      });
      customerId = customer.id;

      await query(
        `UPDATE organisations
          SET stripe_customer_id = $1, updated_at = NOW()
          WHERE id = $2`,
        [customerId, orgId],
      );
    }

    const appUrl = getAppUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Portal session creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
