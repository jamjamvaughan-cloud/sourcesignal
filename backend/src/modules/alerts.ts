/**
 * SourceSignal — Alerts & Signal Rules Module.
 *
 * Fastify route handlers for /alerts/* and /signal-rules/*.
 * Uses the shared PostgreSQL pool via @/config/database. All queries are
 * parameterised; tier gating is enforced by the frontend layer.
 */

import { FastifyInstance } from "fastify";
import { query } from "../config/database";

export async function alertsRoutes(fastify: FastifyInstance) {
  // GET /alerts — list the caller's alerts
  fastify.get("/alerts", async (request, reply) => {
    const userId = (request.query as { userId?: string }).userId;
    if (!userId) {
      return reply.code(400).send({ error: "userId is required." });
    }

    try {
      const result = await query(
        `SELECT id, user_id, name, query_filters, is_active,
                created_at, updated_at
           FROM alerts
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [userId],
      );
      return { status: "success", data: result.rows };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to load alerts.",
      });
    }
  });

  // POST /alerts — create a new alert
  fastify.post("/alerts", async (request, reply) => {
    const { userId, title, sector, minVal } = request.body as {
      userId?: string;
      title?: string;
      sector?: string;
      minVal?: number;
    };

    if (!userId || !title) {
      return reply.code(400).send({ error: "userId and title are required." });
    }

    try {
      const result = await query(
        `INSERT INTO alerts (user_id, name, sector, min_value, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
         RETURNING id, user_id, name, sector, min_value, is_active, created_at, updated_at`,
        [userId, title, sector ?? null, minVal ?? null],
      );
      return { status: "success", data: result.rows[0] };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to create alert.",
      });
    }
  });

  // GET /signal-rules — list signal rules
  fastify.get("/signal-rules", async (request, reply) => {
    const orgId = (request.query as { organisationId?: string }).organisationId;

    try {
      const result = orgId
        ? await query(
            `SELECT * FROM signal_rules
             WHERE organisation_id = $1 AND is_active = TRUE
             ORDER BY created_at DESC`,
            [orgId],
          )
        : await query(
            `SELECT * FROM signal_rules
             WHERE is_active = TRUE
             ORDER BY created_at DESC`,
          );

      return { status: "success", data: result.rows };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to load signal rules.",
      });
    }
  });
}
