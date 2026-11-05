"use strict";
/**
 * SourceSignal — Webhooks module.
 *
 * Outbound webhook stream with SHA-256 HMAC signatures. Endpoints here enqueue
 * delivery jobs to the BullMQ "webhook-delivery" queue; the dedicated
 * background worker performs the actual HTTP POST with retries, so webhook
 * delivery never blocks the API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookQueue = exports.WEBHOOK_QUEUE_NAME = void 0;
exports.signPayload = signPayload;
exports.buildSignalPayload = buildSignalPayload;
exports.verifySignature = verifySignature;
exports.webhooksRoutes = webhooksRoutes;
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const bullmq_1 = require("bullmq");
const database_1 = require("../../config/database");
/* ------------------------------------------------------------------ */
/* BullMQ delivery queue (shared with the background worker)          */
/* ------------------------------------------------------------------ */
exports.WEBHOOK_QUEUE_NAME = "webhook-delivery";
/** BullMQ queue for asynchronous webhook delivery. */
exports.webhookQueue = new bullmq_1.Queue(exports.WEBHOOK_QUEUE_NAME, {
    connection: database_1.redis,
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
const signPayloadSchema = zod_1.z.object({
    secret: zod_1.z.string().min(1),
    payload: zod_1.z.record(zod_1.z.unknown()),
});
const deliverSchema = zod_1.z.object({
    url: zod_1.z.string().url().max(2048),
    secret: zod_1.z.string().min(1).optional(),
    payload: zod_1.z.record(zod_1.z.unknown()),
    signal_id: zod_1.z.string().uuid().optional(),
});
const verifySignatureSchema = zod_1.z.object({
    secret: zod_1.z.string().min(1),
    payload: zod_1.z.string(), // raw JSON string to verify against signature
    signature: zod_1.z.string(),
});
/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
/** HMAC-SHA256 signature over the canonical JSON payload. */
function signPayload(secret, payload) {
    return (0, crypto_1.createHmac)("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}
/** Build the standard outbound webhook payload envelope. */
function buildSignalPayload(signal) {
    return {
        event: "signal.created",
        timestamp: new Date().toISOString(),
        signal,
    };
}
/** Verifies an HMAC-SHA256 signature (timing-safe comparison). */
function verifySignature(secret, payload, signature) {
    const expected = (0, crypto_1.createHmac)("sha256", secret).update(payload).digest("hex");
    try {
        return (0, crypto_1.createHmac)("sha256", secret).digest().length === expected.length &&
            (() => {
                const a = Buffer.from(signature, "hex");
                const b = Buffer.from(expected, "hex");
                if (a.length !== b.length)
                    return false;
                let diff = 0;
                for (let i = 0; i < a.length; i++)
                    diff |= a[i] ^ b[i];
                return diff === 0;
            })();
    }
    catch {
        return false;
    }
}
/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */
function webhooksRoutes(app) {
    // POST /webhooks/sign — sign an arbitrary payload (integration helper)
    app.post("/sign", async (request, reply) => {
        const { secret, payload } = signPayloadSchema.parse(request.body);
        const signature = signPayload(secret, payload);
        return reply.send({ signature, algorithm: "HMAC-SHA256" });
    });
    // POST /webhooks/verify — verify an HMAC-SHA256 signature
    app.post("/verify", async (request, reply) => {
        const { secret, payload, signature } = verifySignatureSchema.parse(request.body);
        const valid = verifySignature(secret, payload, signature);
        return reply.send({ valid });
    });
    // POST /webhooks/deliver — enqueue an outbound webhook delivery job
    app.post("/deliver", async (request, reply) => {
        const { url, secret, payload, signal_id } = deliverSchema.parse(request.body);
        const envelope = buildSignalPayload(payload);
        const signature = secret ? signPayload(secret, envelope) : undefined;
        const job = await exports.webhookQueue.add("deliver", {
            url,
            secret,
            payload: envelope,
            signature,
            signal_id,
            attempts_left: 5,
        }, {
            jobId: `webhook:${signal_id ?? crypto.randomUUID()}`,
        });
        return reply.code(202).send({
            accepted: true,
            jobId: job.id,
            queue: exports.WEBHOOK_QUEUE_NAME,
        });
    });
    // GET /webhooks/health — queue connectivity check
    app.get("/health", async (request, reply) => {
        try {
            await exports.webhookQueue.getJobCounts();
            return reply.send({ queue: exports.WEBHOOK_QUEUE_NAME, status: "connected" });
        }
        catch (err) {
            return reply.code(503).send({
                queue: exports.WEBHOOK_QUEUE_NAME,
                status: "disconnected",
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
}
//# sourceMappingURL=routes.js.map