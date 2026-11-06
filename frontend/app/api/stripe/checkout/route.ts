/**
 * Stripe checkout session creation (Phase F).
 *
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the Pro plan with multi-currency
 * support. Accepts an optional `currency` parameter (GBP, USD, EUR, AUD)
 * defaulting to the user's organisation country code, then USD/GBP fallback.
 * Server-side only. The authenticated user's organisation is mapped to the
 * Stripe customer. Secret keys never reach the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getStripeConfig } from "@/lib/env";
import { getAppUrl } from "@/lib/url";
import type Stripe from "stripe";

/** Regional Stripe Price IDs for the Pro plan, keyed by currency code. */
const PRICE_IDS_BY_CURRENCY: Record<string, string> = {
  GBP: process.env.STRIPE_PRICE_ID_PRO_GBP ?? "",
  USD: process.env.STRIPE_PRICE_ID_PRO_USD ?? "",
  EUR: process.env.STRIPE_PRICE_ID_PRO_EUR ?? "",
  AUD: process.env.STRIPE_PRICE_ID_PRO_AUD ?? "",
};

/** Fallback currency order when the user's country is not supported. */
const FALLBACK_CURRENCIES = ["USD", "GBP"] as const;

async function requireUser(
  request: NextRequest,
): Promise<{ id: string; email: string; country?: string } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return { id: user.id, email: user.email, country: user.country ?? undefined };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId, email, country } = userOrError;

  const stripeConfig = getStripeConfig();
  if (!stripeConfig.secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  // Determine currency: request body > user's country > fallback
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const requestedCurrency = (body.currency as string | undefined)?.toUpperCase();
  const currency =
    requestedCurrency && PRICE_IDS_BY_CURRENCY[requestedCurrency]
      ? requestedCurrency
      : country && PRICE_IDS_BY_CURRENCY[country.toUpperCase()]
        ? country.toUpperCase()
        : FALLBACK_CURRENCIES.find(
            (c) => PRICE_IDS_BY_CURRENCY[c],
          ) ?? "USD";

  const priceId = PRICE_IDS_BY_CURRENCY[currency];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for currency ${currency}.` },
      { status: 503 },
    );
  }

  // Dynamically import Stripe so the module is only loaded when Stripe is used.
  const StripeModule = await import("stripe");
  const StripeClass = StripeModule.default as typeof Stripe;

  const stripe = new StripeClass(stripeConfig.secretKey, {
    apiVersion: "2024-10-28.acacia",
  });

  try {
    // Find the user's organisation membership via PostgreSQL.
    const orgResult = await query(
      `SELECT o.id, o.country, o.stripe_customer_id
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

    // Use request currency or fall back to user's country, then to default
    const effectiveCurrency =
      currency === "USD" && country && PRICE_IDS_BY_CURRENCY[country.toUpperCase()]
        ? country.toUpperCase()
        : currency;

    const finalPriceId =
      PRICE_IDS_BY_CURRENCY[effectiveCurrency] ?? priceId;

    // Check if the organisation already has a Stripe customer.
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      currency: effectiveCurrency.toLowerCase(),
      success_url: `${appUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing`,
      metadata: {
        organisationId: orgId,
        userId,
        currency: effectiveCurrency,
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout session creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}