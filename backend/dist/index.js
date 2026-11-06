"use strict";
/**
 * SourceSignal — Application entry point / server bootstrap.
 *
 * Stateless Fastify API. Session storage, rate limiting and background work
 * are decoupled into Redis / BullMQ, so instances are safe to replicate
 * horizontally behind Traefik.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const database_1 = require("./config/database");
const routes_1 = require("./modules/auth/routes");
const routes_2 = require("./modules/signals/routes");
const routes_3 = require("./modules/webhooks/routes");
const opportunities_1 = require("./modules/opportunities");
const stripe_1 = require("./modules/stripe");
const intelligence_1 = require("./modules/intelligence");
/** Builds and configures the Fastify application. */
function buildApp() {
    const app = (0, fastify_1.default)({
        logger: {
            level: process.env.LOG_LEVEL ?? "info",
        },
        requestTimeout: 30_000,
        keepAliveTimeout: 5_000,
        pluginTimeout: 30_000,
    });
    app.log.info("Boot: registering CORS plugin");
    // CORS (restrict origins to configured APP_ORIGIN in production).
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.API_URL ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    app.register(cors_1.default, {
        origin: (origin, cb) => {
            if (!origin)
                return cb(null, true);
            if (allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
                return cb(null, true);
            }
            return cb(new Error("Not allowed by CORS"), false);
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
        credentials: true,
    });
    app.log.info("Boot: CORS plugin registered");
    // Health / readiness (no auth required — Traefik polls this).
    app.get("/healthz", async () => {
        const [db, redis] = await Promise.all([
            (0, database_1.dbHealthCheck)(),
            (0, database_1.redisHealthCheck)(),
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
            (0, database_1.dbHealthCheck)(),
            (0, database_1.redisHealthCheck)(),
        ]);
        if (!db || !redis) {
            return reply.code(503).send({ status: "unavailable" });
        }
        return { status: "ready" };
    });
    // API routes
    app.log.info("Boot: registering authRoutes plugin");
    app.register(async (app, opts) => {
        (0, routes_1.authRoutes)(app);
    }, { prefix: "/auth" });
    app.log.info("Boot: authRoutes plugin registered");
    app.log.info("Boot: registering signalsRoutes plugin");
    app.register(async (app, opts) => {
        (0, routes_2.signalsRoutes)(app);
    }, { prefix: "/signals" });
    app.log.info("Boot: signalsRoutes plugin registered");
    app.log.info("Boot: registering webhooksRoutes plugin");
    app.register(async (app, opts) => {
        (0, routes_3.webhooksRoutes)(app);
    }, { prefix: "/webhooks" });
    app.log.info("Boot: webhooksRoutes plugin registered");
    app.log.info("Boot: registering opportunitiesRoutes plugin");
    app.register(async (app, opts) => {
        (0, opportunities_1.opportunitiesRoutes)(app);
    });
    app.log.info("Boot: registering stripeRoutes plugin");
    app.register(async (app, opts) => {
        (0, stripe_1.stripeRoutes)(app);
    });
    app.log.info("Boot: registering intelligenceRoutes plugin");
    app.register(async (app, opts) => {
        (0, intelligence_1.intelligenceRoutes)(app);
    });
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
        process.on(signal, async () => {
            app.log.info({ signal }, "Received shutdown signal, closing...");
            try {
                await app.close();
                await (0, database_1.closeConnections)();
                app.log.info("Shutdown complete");
                process.exit(0);
            }
            catch (err) {
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
//# sourceMappingURL=index.js.map