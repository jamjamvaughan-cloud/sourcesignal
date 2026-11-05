/**
 * SourceSignal — Webhooks module.
 *
 * Outbound webhook stream with SHA-256 HMAC signatures. Endpoints here enqueue
 * delivery jobs to the BullMQ "webhook-delivery" queue; the dedicated
 * background worker performs the actual HTTP POST with retries, so webhook
 * delivery never blocks the API.
 */
import { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
export declare const WEBHOOK_QUEUE_NAME = "webhook-delivery";
/** BullMQ queue for asynchronous webhook delivery. */
export declare const webhookQueue: Queue<any, any, string, any, any, string>;
/** HMAC-SHA256 signature over the canonical JSON payload. */
export declare function signPayload(secret: string, payload: unknown): string;
/** Build the standard outbound webhook payload envelope. */
export declare function buildSignalPayload(signal: Record<string, unknown>): {
    event: string;
    timestamp: string;
    signal: Record<string, unknown>;
};
/** Verifies an HMAC-SHA256 signature (timing-safe comparison). */
export declare function verifySignature(secret: string, payload: string, signature: string): boolean;
export declare function webhooksRoutes(app: FastifyInstance): void;
//# sourceMappingURL=routes.d.ts.map