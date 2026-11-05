/**
 * SourceSignal — Signals module.
 *
 * CRUD endpoints for competitive signal ingestion with JSONB payloads.
 * Every inserted signal receives a SHA-256 content_hash (over the canonical
 * raw_payload) so duplicate ingestion can be detected and deduplicated.
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash } from "crypto";
import { query } from "../../config/database";

/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const createSignalSchema = z.object({
  organisation_id: z.string().uuid("organisation_id must be a valid UUID"),
  title: z.string().min(1).max(500),
  source_url: z.string().url().max(2048).optional(),
  raw_payload: z.record(z.unknown()).default({}),
});

const listSignalsSchema = z.object({
  organisation_id: z.string().uuid().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .default("50"),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(0))
    .default("0"),
});

const signalIdSchema = z.object({
  id: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** SHA-256 content hash over the canonical JSON payload (hex, 64 chars). */
export function computeContentHash(rawPayload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(rawPayload))
    .digest("hex");
}

/** Sanitises a signal row for the API response. */
function sanitiseSignal(row: Record<string, unknown>) {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    title: row.title,
    source_url: row.source_url,
    content_hash: row.content_hash,
    raw_payload: row.raw_payload,
    created_at: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

export function signalsRoutes(app: FastifyInstance) {
  // GET /signals — list signals for an organisation (paginated)
  app.get("/", async (request, reply) => {
    const { organisation_id, limit, offset } = listSignalsSchema.parse(
      request.query,
    );

    let countText = "SELECT COUNT(*) FROM signals";
    let countParams: unknown[] = [];
    let dataText = `
      SELECT id, organisation_id, title, source_url, content_hash, raw_payload, created_at
      FROM signals
    `;
    const dataParams: unknown[] = [];
    let paramIndex = 1;

    if (organisation_id) {
      const where = ` WHERE organisation_id = $${paramIndex++}`;
      countText += where;
      dataText += where;
      countParams.push(organisation_id);
      dataParams.push(organisation_id);
    }

    dataText += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    dataParams.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      query(countText, countParams),
      query(dataText, dataParams),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);

    return reply.send({
      signals: dataResult.rows.map(sanitiseSignal),
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  });

  // POST /signals — create a signal (compute content_hash from raw_payload)
  app.post("/", async (request, reply) => {
    const body = createSignalSchema.parse(request.body);
    const contentHash = computeContentHash(body.raw_payload);

    const result = await query(
      `INSERT INTO signals (
        organisation_id, title, source_url, content_hash, raw_payload, created_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, organisation_id, title, source_url, content_hash, raw_payload, created_at`,
      [
        body.organisation_id,
        body.title,
        body.source_url,
        contentHash,
        body.raw_payload,
      ],
    );

    return reply.code(201).send(sanitiseSignal(result.rows[0]));
  });

  // GET /signals/:id — fetch a single signal
  app.get("/:id", async (request, reply) => {
    const { id } = signalIdSchema.parse(request.params);

    const result = await query(
      `SELECT id, organisation_id, title, source_url, content_hash, raw_payload, created_at
       FROM signals WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Signal not found" });
    }

    return reply.send(sanitiseSignal(result.rows[0]));
  });

  // DELETE /signals/:id — remove a signal
  app.delete("/:id", async (request, reply) => {
    const { id } = signalIdSchema.parse(request.params);

    const result = await query("DELETE FROM signals WHERE id = $1 RETURNING id", [
      id,
    ]);
    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Signal not found" });
    }

    return reply.send({ ok: true, id });
  });
}
