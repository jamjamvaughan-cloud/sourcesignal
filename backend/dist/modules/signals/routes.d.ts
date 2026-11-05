/**
 * SourceSignal — Signals module.
 *
 * CRUD endpoints for competitive signal ingestion with JSONB payloads.
 * Every inserted signal receives a SHA-256 content_hash (over the canonical
 * raw_payload) so duplicate ingestion can be detected and deduplicated.
 */
import { FastifyInstance } from "fastify";
/** SHA-256 content hash over the canonical JSON payload (hex, 64 chars). */
export declare function computeContentHash(rawPayload: unknown): string;
export declare function signalsRoutes(app: FastifyInstance): void;
//# sourceMappingURL=routes.d.ts.map