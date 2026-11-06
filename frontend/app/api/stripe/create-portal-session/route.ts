/**
 * POST /api/stripe/create-portal-session
 *
 * Creates a Stripe Billing Portal session so the authenticated user can
 * manage payment methods, view invoices, or cancel their subscription.
 *
 * Requires a valid session cookie. The user must have a Stripe customer ID
 * on their user record.
 *
 * Stripe instance is created lazily at request time so that `next build` on
 * Vercel does not fail when STRIPE_SECRET_KEY is not set at build time.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { error, info } from "@/lib/logger";
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-10-28.acacia",
    });
  }
  return stripeInstance;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [user.id],
    );
    const row = result.rows[0];
    const stripeCustomerId = row?.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found. Subscribe first." },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://sourcesignal.site"}/dashboard/profile`,
    });

    info("stripe_portal_session_created", {
      userId: user.id,
      stripeCustomerId,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    error("stripe_portal_session_failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create portal session." },
      { status: 500 },
    );
  }
}