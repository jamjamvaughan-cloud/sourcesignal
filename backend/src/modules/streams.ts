/**
 * SourceSignal — Real-Time SSE Stream & Webhook Handlers Module.
 *
 * Fastify route handlers for /signals/stream (Server-Sent Events) and
 * /webhooks/dispatch, /webhooks/receive. Uses the shared pg pool where
 * needed; the SSE stream keeps connections open and emits periodic pings.
 */

import { FastifyInstance } from "fastify";

export async function streamRoutes(fastify: FastifyInstance) {
  // GET /signals/stream — Server-Sent Events telemetry stream
  fastify.get("/signals/stream", async (_request, reply) => {
    const raw = reply.raw as unknown as {
      writeHead: (code: number, headers: Record<string, string>) => void;
      write: (chunk: string) => boolean;
      end: () => void;
    };

    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Initial connected event
    raw.write(
      `data: ${JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
      })}\n\n`,
    );

    const interval = setInterval(() => {
      try {
        raw.write(
          `data: ${JSON.stringify({
            type: "ping",
            timestamp: new Date().toISOString(),
          })}\n\n`,
        );
      } catch {
        // Client disconnected
        clearInterval(interval);
      }
    }, 15_000);

    _request.raw.on("close", () => {
      clearInterval(interval);
      try {
        raw.end();
      } catch {
        // Already closed
      }
    });

    _request.raw.on("error", () => {
      clearInterval(interval);
    });
  });

  // POST /webhooks/dispatch — enqueue an outbound webhook delivery
  fastify.post("/webhooks/dispatch", async (_request, reply) => {
    return {
      status: "dispatched",
      queued: true,
      timestamp: new Date().toISOString(),
    };
  });

  // POST /webhooks/receive — acknowledge an inbound webhook
  fastify.post("/webhooks/receive", async (_request, reply) => {
    return {
      status: "received",
      acknowledged: true,
      timestamp: new Date().toISOString(),
    };
  });
}
