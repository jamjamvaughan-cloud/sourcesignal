/**
 * SourceSignal — Webhooks module.
 *
 * Outbound webhook stream with SHA-256 HMAC signatures. Endpoints here enqueue
 * delivery jobs to the BullMQ "webhook-delivery" queue; the dedicated
 * background worker performs the actual HTTP POST with retries, so webhook
 * delivery never blocks the API.
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHmac } from "crypto";
import { Queue } from "bullmq";
import { redis } from "../../config/database";

/* ------------------------------------------------------------------ */
/* BullMQ delivery queue (shared with the background worker)          */
/* ------------------------------------------------------------------ */

export const WEBHOOK_QUEUE_NAME = "webhook-delivery";

/** BullMQ queue for asynchronous webhook delivery. */
export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const signPayloadSchema = z.object({
  secret: z.string().min(1),
  payload: z.record(z.unknown()),
});

const deliverSchema = z.object({
  url: z.string().url().max(2048),
  secret: z.string().min(1).optional(),
  payload: z.record(z.unknown()),
  signal_id: z.string().uuid().optional(),
});

const verifySignatureSchema = z.object({
  secret: z.string().min(1),
  payload: z.string(), // raw JSON string to verify against signature
  signature: z.string(),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** HMAC-SHA256 signature over the canonical JSON payload. */
export function signPayload(secret: string, payload: unknown): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

/** Build the standard outbound webhook payload envelope. */
export function buildSignalPayload(signal: Record<string, unknown>) {
  return {
    event: "signal.created",
    timestamp: new Date().toISOString(),
    signal,
  };
}

/** Verifies an HMAC-SHA256 signature (timing-safe comparison). */
export function verifySignature(
  secret: string,
  payload: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return createHmac("sha256", secret).digest().length === expected.length &&
      (() => {
        const a = Buffer.from(signature, "hex");
        const b = Buffer.from(expected, "hex");
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        return diff === 0;
      })();
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

export function webhooksRoutes(app: FastifyInstance) {
  // POST /webhooks/sign — sign an arbitrary payload (integration helper)
  app.post("/sign", async (request, reply) => {
    const { secret, payload } = signPayloadSchema.parse(request.body);
    const signature = signPayload(secret, payload);
    return reply.send({ signature, algorithm: "HMAC-SHA256" });
  });

  // POST /webhooks/verify — verify an HMAC-SHA256 signature
  app.post("/verify", async (request, reply) => {
    const { secret, payload, signature } = verifySignatureSchema.parse(
      request.body,
    );
    const valid = verifySignature(secret, payload, signature);
    return reply.send({ valid });
  });

  // POST /webhooks/deliver — enqueue an outbound webhook delivery job
  app.post("/deliver", async (request, reply) => {
    const { url, secret, payload, signal_id } = deliverSchema.parse(
      request.body,
    );

    const envelope = buildSignalPayload(payload);
    const signature = secret ? signPayload(secret, envelope) : undefined;

    const job = await webhookQueue.add(
      "deliver",
      {
        url,
        secret,
        payload: envelope,
        signature,
        signal_id,
        attempts_left: 5,
      },
      {
        jobId: `webhook:${signal_id ?? crypto.randomUUID()}`,
      },
    );

    return reply.code(202).send({
      accepted: true,
      jobId: job.id,
      queue: WEBHOOK_QUEUE_NAME,
    });
  });

  // GET /webhooks/health — queue connectivity check
  app.get("/health", async (request, reply) => {
    try {
      await webhookQueue.getJobCounts();
      return reply.send({ queue: WEBHOOK_QUEUE_NAME, status: "connected" });
    } catch (err) {
      return reply.code(503).send({
        queue: WEBHOOK_QUEUE_NAME,
        status: "disconnected",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
