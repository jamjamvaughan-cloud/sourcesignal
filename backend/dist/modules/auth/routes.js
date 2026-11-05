"use strict";
/**
 * SourceSignal — Auth module.
 *
 * JWT signup, login, and session validation endpoints.
 *
 * Sessions are decoupled into Redis (key: `session:<userId>`) so any API
 * replica can validate a session — no sticky sessions, no local state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const database_1 = require("../../config/database");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "7d");
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
if (!JWT_SECRET) {
    // Thrown at import time so misconfiguration is caught early in prod.
    throw new Error("JWT_SECRET is required. Set it in .env (see .env.example).");
}
/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase().trim(),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    full_name: zod_1.z.string().trim().max(255).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase().trim(),
    password: zod_1.z.string(),
});
/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
/** Extracts a bearer token from Authorization header or session cookie. */
function extractToken(authorization, cookie) {
    if (authorization?.startsWith("Bearer ")) {
        return authorization.slice("Bearer ".length);
    }
    if (cookie) {
        const match = cookie.match(/(?:^|;\s*)session_id=([^;]+)/);
        if (match)
            return match[1];
    }
    return null;
}
/** Signs a JWT for the given user. */
function signToken(userId, email) {
    return (0, jsonwebtoken_1.sign)({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
/** Stores a session marker in Redis (decoupled session storage). */
async function storeSession(userId) {
    await database_1.redis.set(`session:${userId}`, userId, "EX", SESSION_TTL_SECONDS);
}
/** Removes a session marker from Redis. */
async function clearSession(userId) {
    await database_1.redis.del(`session:${userId}`);
}
/** Sanitises a user row (never return password_hash). */
function sanitiseUser(row) {
    return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        created_at: row.created_at,
    };
}
/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */
function authRoutes(app) {
    // POST /auth/signup — create account, issue JWT, store session in Redis
    app.post("/signup", async (request, reply) => {
        const body = signupSchema.parse(request.body);
        const existing = await (0, database_1.query)("SELECT id FROM users WHERE email = $1", [body.email]);
        if ((existing.rowCount ?? 0) > 0) {
            return reply.code(409).send({ error: "Email already registered" });
        }
        const passwordHash = await (0, bcryptjs_1.hash)(body.password, 12);
        const result = await (0, database_1.query)(`INSERT INTO users (email, password_hash, full_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, email, full_name, created_at`, [body.email, passwordHash, body.full_name]);
        const user = result.rows[0];
        const token = signToken(user.id, user.email);
        await storeSession(user.id);
        return reply.code(201).send({
            user: sanitiseUser(user),
            token,
        });
    });
    // POST /auth/login — verify credentials, issue JWT, store session in Redis
    app.post("/login", async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const result = await (0, database_1.query)("SELECT id, email, password_hash, full_name FROM users WHERE email = $1", [body.email]);
        if (result.rowCount === 0) {
            return reply.code(401).send({ error: "Invalid credentials" });
        }
        const user = result.rows[0];
        const valid = await (0, bcryptjs_1.compare)(body.password, user.password_hash);
        if (!valid) {
            return reply.code(401).send({ error: "Invalid credentials" });
        }
        const token = signToken(user.id, user.email);
        await storeSession(user.id);
        return reply.send({
            user: sanitiseUser(user),
            token,
        });
    });
    // POST /auth/logout — clear the Redis session
    app.post("/logout", async (request, reply) => {
        const token = extractToken(request.headers.authorization, request.headers.cookie);
        if (token) {
            try {
                const payload = (0, jsonwebtoken_1.verify)(token, JWT_SECRET);
                if (payload.userId) {
                    await clearSession(payload.userId);
                }
            }
            catch {
                // Token invalid — nothing to clear.
            }
        }
        return reply.send({ ok: true });
    });
    // GET /auth/me — session validation (verify JWT + confirm Redis session)
    app.get("/me", async (request, reply) => {
        const token = extractToken(request.headers.authorization, request.headers.cookie);
        if (!token) {
            return reply.code(401).send({ error: "Not authenticated" });
        }
        let payload;
        try {
            payload = (0, jsonwebtoken_1.verify)(token, JWT_SECRET);
        }
        catch {
            return reply.code(401).send({ error: "Invalid or expired token" });
        }
        // Confirm the session is still alive in Redis (decoupled session store).
        const sessionAlive = await database_1.redis.get(`session:${payload.userId}`);
        if (!sessionAlive) {
            return reply.code(401).send({ error: "Session not found or expired" });
        }
        const result = await (0, database_1.query)("SELECT id, email, full_name, created_at FROM users WHERE id = $1", [payload.userId]);
        if (result.rowCount === 0) {
            return reply.code(401).send({ error: "User not found" });
        }
        return reply.send({
            authenticated: true,
            user: sanitiseUser(result.rows[0]),
        });
    });
}
//# sourceMappingURL=routes.js.map