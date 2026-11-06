/**
 * SourceSignal — Saved Opportunities & User Preferences Module.
 *
 * Fastify route handlers for /saved-opportunities and /user/preferences.
 * Uses the shared PostgreSQL pool via @/config/database. JWT verification
 * is done manually with jsonwebtoken (matching the auth module pattern).
 */

import { FastifyInstance } from "fastify";
import { verify } from "jsonwebtoken";
import { query } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing on server startup.");
}

const JWT_SECRET_FOR_SIGNING = JWT_SECRET as string;

/** Extracts and verifies a JWT from the Authorization header. */
async function getUserIdFromToken(fastify: FastifyInstance, request: { headers: { authorization?: string } }): Promise<string | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = verify(token, JWT_SECRET_FOR_SIGNING) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

export async function userPrefsRoutes(fastify: FastifyInstance) {
  // GET /saved-opportunities — list the caller's saved signals
  fastify.get("/saved-opportunities", async (request, reply) => {
    const userId = await getUserIdFromToken(fastify, request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    try {
      const result = await query(
        `SELECT s.id, s.title, s.buyer_name, s.jurisdiction, s.sector,
                s.opportunity_type, s.estimated_value, s.source_name,
                s.source_url, s.source_hash, s.sha256_hash,
                s.commercial_why, s.published_at, s.created_at,
                so.created_at AS saved_at
           FROM saved_opportunities so
           JOIN signals s ON s.id = so.signal_id
          WHERE so.user_id = $1
          ORDER BY so.created_at DESC`,
        [userId],
      );
      return { status: "success", data: result.rows };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to load saved opportunities.",
      });
    }
  });

  // POST /saved-opportunities — save a signal
  fastify.post("/saved-opportunities", async (request, reply) => {
    const userId = await getUserIdFromToken(fastify, request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { signalId } = request.body as { signalId?: string };
    if (!signalId) {
      return reply.code(400).send({ error: "signalId is required." });
    }

    try {
      const result = await query(
        `INSERT INTO saved_opportunities (user_id, signal_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, signal_id) DO NOTHING
         RETURNING id, user_id, signal_id, created_at`,
        [userId, signalId],
      );
      return { status: "success", data: result.rows[0] };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to save opportunity.",
      });
    }
  });

  // DELETE /saved-opportunities/:signalId — unsave a signal
  fastify.delete("/saved-opportunities/:signalId", async (request, reply) => {
    const userId = await getUserIdFromToken(fastify, request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { signalId } = request.params as { signalId: string };

    try {
      const result = await query(
        `DELETE FROM saved_opportunities
         WHERE user_id = $1 AND signal_id = $2
         RETURNING id`,
        [userId, signalId],
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "Saved opportunity not found." });
      }
      return { status: "success", message: "Unsaved." };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to unsave opportunity.",
      });
    }
  });

  // GET /user/preferences — caller's UI preferences
  fastify.get("/user/preferences", async (_request, reply) => {
    return {
      status: "success",
      preferences: {
        theme: "cosmic-dark",
        notifications: true,
      },
    };
  });
}
