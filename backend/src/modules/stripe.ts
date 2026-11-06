/**
 * SourceSignal — Stripe Billing & Subscriptions Module.
 *
 * Fastify route handlers for /stripe/* endpoints. The webhook handler
 * captures the raw request body via `request.raw` (the Node.js IncomingMessage)
 * for Stripe signature verification. Stripe is imported lazily so the module
 * loads even when STRIPE_SECRET_KEY is not configured at build time.
 */

import { FastifyInstance } from "fastify";
import { query } from "../config/database";

type StripeClass = new (key: string, options?: { apiVersion?: unknown }) => {
  checkout: { sessions: { create: (data: unknown) => Promise<{ id: string; url: string }> } };
  webhooks: { constructEvent: (payload: string, sig: string, secret: string) => { type: string; data: { object: unknown } } };
  Subscriptions: { retrieve: (id: string) => Promise<unknown> };
  customers: { create: (data: unknown) => Promise<{ id: string }> };
  billingPortal: { sessions: { create: (data: unknown) => Promise<{ url: string }> } };
};

type StripeEvent = { type: string; data: { object: unknown } };

let StripeClass: StripeClass | null = null;

async function getStripeClass(): Promise<StripeClass | null> {
  if (StripeClass) return StripeClass;
  try {
    const StripeModule = await import("stripe");
    StripeClass = StripeModule.default as unknown as StripeClass;
    return StripeClass;
  } catch {
    return null;
  }
}

/** Reads the raw request body as a string for signature verification. */
async function readRawBody(
  request: { raw: NodeJS.ReadableStream },
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request.raw) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function stripeRoutes(fastify: FastifyInstance) {
  // POST /stripe/checkout — create a Stripe Checkout session
  fastify.post("/stripe/checkout", async (request, reply) => {
    const Stripe = await getStripeClass();
    if (!Stripe) {
      return reply.code(503).send({
        error: "Stripe integration not available.",
      });
    }

    try {
      const { priceId, userId } = request.body as {
        priceId?: string;
        userId?: string;
      };

      if (!priceId || !userId) {
        return reply.code(400).send({
          error: "priceId and userId are required.",
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2024-10-28.acacia" as unknown,
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL ?? "https://sourcesignal.site"}/dashboard?success=true`,
        cancel_url: `${process.env.FRONTEND_URL ?? "https://sourcesignal.site"}/pricing?canceled=true`,
        metadata: { userId },
      });

      return { sessionId: session.id, url: session.url };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Checkout session creation failed.",
      });
    }
  });

  // POST /stripe/webhook — verify Stripe signature and process events
  fastify.post("/stripe/webhook", async (request, reply) => {
    const Stripe = await getStripeClass();
    if (!Stripe) {
      return reply.code(503).send({
        error: "Stripe integration not available.",
      });
    }

    const sig = request.headers["stripe-signature"] as string | undefined;
    if (!sig) {
      return reply.code(400).send("Missing Stripe signature header.");
    }

    const rawBody = await readRawBody(request);

    let event: StripeEvent;
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2024-10-28.acacia" as unknown,
      });
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      ) as StripeEvent;
    } catch (err: unknown) {
      fastify.log.warn({ err }, "Stripe webhook signature verification failed");
      return reply.code(400).send(
        `Webhook Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      // Handle checkout.session.completed → activate subscription
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as {
          metadata?: { userId?: string };
          customer?: string;
          subscription?: string;
        };
        const userId = session.metadata?.userId;

        if (userId && session.customer && session.subscription) {
          await query(
            `UPDATE users
               SET stripe_customer_id = $1,
                   stripe_subscription_id = $2,
                   stripe_status = 'active',
                   updated_at = NOW()
             WHERE id = $3`,
            [session.customer, session.subscription, userId],
          );
        }
      }

      // Handle subscription updates / cancellations
      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object as {
          customer?: string;
          status?: string;
        };
        const customerId = subscription.customer;
        const status = subscription.status;

        if (customerId && status) {
          await query(
            `UPDATE users
               SET stripe_status = $1,
                   updated_at = NOW()
             WHERE stripe_customer_id = $2`,
            [status, customerId],
          );
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as {
          customer?: string;
        };
        const customerId = subscription.customer;

        if (customerId) {
          await query(
            `UPDATE users
               SET stripe_status = 'canceled',
                   updated_at = NOW()
             WHERE stripe_customer_id = $1`,
            [customerId],
          );
        }
      }

      return { received: true };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Webhook processing failed.",
      });
    }
  });
}
