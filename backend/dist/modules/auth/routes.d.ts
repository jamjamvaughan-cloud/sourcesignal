/**
 * SourceSignal — Auth module.
 *
 * JWT signup, login, and session validation endpoints.
 *
 * Sessions are decoupled into Redis (key: `session:<userId>`) so any API
 * replica can validate a session — no sticky sessions, no local state.
 */
import { FastifyInstance } from "fastify";
export declare function authRoutes(app: FastifyInstance): void;
//# sourceMappingURL=routes.d.ts.map