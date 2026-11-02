import { NextResponse } from "next/server";
import Stripe from "stripe";
import { error } from "@/lib/logger";

/**
 * Lightweight checkout-session endpoint used by the public upgrade flow.
 *
 * POST /api/create-checkout-session
 * Body: { "email": "name@company.com" }
 *
 * The authenticated, organisation-aware flow lives at /api/stripe/checkout.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID_PRO;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!secretKey || !priceId) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  let email: string | undefined;

  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-10-28.endive",
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
      automatic_tax: { enabled: true },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Checkout session creation failed.";
    error("Error creating checkout session", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
