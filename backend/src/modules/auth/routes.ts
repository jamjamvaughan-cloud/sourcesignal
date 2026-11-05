/**
 * SourceSignal — Auth module.
 *
 * JWT signup, login, and session validation endpoints.
 *
 * Sessions are decoupled into Redis (key: `session:<userId>`) so any API
 * replica can validate a session — no sticky sessions, no local state.
 */

import type { StringValue } from "ms";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { query, redis } from "../../config/database";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "7d") as StringValue;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

if (!JWT_SECRET) {
  // Thrown at import time so misconfiguration is caught early in prod.
  throw new Error("JWT_SECRET is required. Set it in .env (see .env.example).");
}

/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().trim().max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string(),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Extracts a bearer token from Authorization header or session cookie. */
function extractToken(
  authorization?: string,
  cookie?: string,
): string | null {
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session_id=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/** Signs a JWT for the given user. */
function signToken(userId: string, email: string): string {
  return sign({ userId, email }, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });
}

/** Stores a session marker in Redis (decoupled session storage). */
async function storeSession(userId: string): Promise<void> {
  await redis.set(`session:${userId}`, userId, "EX", SESSION_TTL_SECONDS);
}

/** Removes a session marker from Redis. */
async function clearSession(userId: string): Promise<void> {
  await redis.del(`session:${userId}`);
}

/** Sanitises a user row (never return password_hash). */
function sanitiseUser(row: Record<string, unknown>) {
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

export function authRoutes(app: FastifyInstance) {
  // POST /auth/signup — create account, issue JWT, store session in Redis
  app.post("/signup", async (request, reply) => {
    const body = signupSchema.parse(request.body);

    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [body.email],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await hash(body.password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, email, full_name, created_at`,
      [body.email, passwordHash, body.full_name],
    );

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

    const result = await query(
      "SELECT id, email, password_hash, full_name FROM users WHERE email = $1",
      [body.email],
    );
    if (result.rowCount === 0) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await compare(body.password, user.password_hash);
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
    const token = extractToken(
      request.headers.authorization,
      request.headers.cookie,
    );
    if (token) {
      try {
        const payload = verify(token, JWT_SECRET!) as { userId?: string };
        if (payload.userId) {
          await clearSession(payload.userId);
        }
      } catch {
        // Token invalid — nothing to clear.
      }
    }
    return reply.send({ ok: true });
  });

  // GET /auth/me — session validation (verify JWT + confirm Redis session)
  app.get("/me", async (request, reply) => {
    const token = extractToken(
      request.headers.authorization,
      request.headers.cookie,
    );
    if (!token) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    let payload: { userId?: string; email?: string };
    try {
      payload = verify(token, JWT_SECRET!) as { userId?: string; email?: string };
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }

    // Confirm the session is still alive in Redis (decoupled session store).
    const sessionAlive = await redis.get(`session:${payload.userId}`);
    if (!sessionAlive) {
      return reply.code(401).send({ error: "Session not found or expired" });
    }

    const result = await query(
      "SELECT id, email, full_name, created_at FROM users WHERE id = $1",
      [payload.userId],
    );
    if (result.rowCount === 0) {
      return reply.code(401).send({ error: "User not found" });
    }

    return reply.send({
      authenticated: true,
      user: sanitiseUser(result.rows[0]),
    });
  });
}
