/**
 * SourceSignal — Application entry point / server bootstrap.
 *
 * Stateless Fastify API. Session storage, rate limiting and background work
 * are decoupled into Redis / BullMQ, so instances are safe to replicate
 * horizontally behind Traefik.
 */

import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { closeConnections, dbHealthCheck, redisHealthCheck } from "./config/database";
import { authRoutes } from "./modules/auth/routes";
import { signalsRoutes } from "./modules/signals/routes";
import { webhooksRoutes } from "./modules/webhooks/routes";

/** Builds and configures the Fastify application. */
export function buildApp() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    requestTimeout: 30_000,
    keepAliveTimeout: 5_000,
  });

  // CORS (restrict origins in production via env if desired).
  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
  });

  // Health / readiness (no auth required — Traefik polls this).
  app.get("/healthz", async () => {
    const [db, redis] = await Promise.all([
      dbHealthCheck(),
      redisHealthCheck(),
    ]);
    const healthy = db && redis;
    return {
      status: healthy ? "ok" : "degraded",
      checks: { database: db, redis },
      service: "sourcesignal-backend",
    };
  });

  app.get("/readyz", async (request, reply) => {
    const [db, redis] = await Promise.all([
      dbHealthCheck(),
      redisHealthCheck(),
    ]);
    if (!db || !redis) {
      return reply.code(503).send({ status: "unavailable" });
    }
    return { status: "ready" };
  });

  // API routes
  app.register(authRoutes, { prefix: "/auth" });
  app.register(signalsRoutes, { prefix: "/signals" });
  app.register(webhooksRoutes, { prefix: "/webhooks" });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "Not found", path: request.routerPath });
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: statusCode === 500 ? "Internal server error" : error.message,
    });
  });

  return app;
}

/** Starts the HTTP server and installs graceful shutdown. */
async function main() {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3001);
  const host = "0.0.0.0";

  await app.listen({ port, host });
  app.log.info({ port, host }, "SourceSignal backend API listening");

  // Graceful shutdown on SIGTERM / SIGINT.
  const signals = ["SIGTERM", "SIGINT"];
  for (const signal of signals) {
    process.on(signal as NodeJS.Signals, async () => {
      app.log.info({ signal }, "Received shutdown signal, closing...");
      try {
        await app.close();
        await closeConnections();
        app.log.info("Shutdown complete");
        process.exit(0);
      } catch (err) {
        app.log.error(err, "Error during shutdown");
        process.exit(1);
      }
    });
  }
}

// Only run when executed directly, not when imported by tests.
if (require.main === module) {
  main().catch((err) => {
    console.error("Failed to start backend:", err);
    process.exit(1);
  });
}
