/**
 * SourceSignal — Application entry point / server bootstrap.
 *
 * Stateless Fastify API. Session storage, rate limiting and background work
 * are decoupled into Redis / BullMQ, so instances are safe to replicate
 * horizontally behind Traefik.
 */
import { FastifyInstance } from "fastify";
/** Builds and configures the Fastify application. */
export declare function buildApp(): FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault> & PromiseLike<FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>>;
//# sourceMappingURL=index.d.ts.map