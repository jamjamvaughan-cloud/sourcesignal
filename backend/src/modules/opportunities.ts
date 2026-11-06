/**
 * SourceSignal — Opportunities & Saved Opportunities Module.
 *
 * Fastify route handlers for the /opportunities/* and /saved-opportunities/*
 * API surface. Reuses the shared PostgreSQL pool from @/config/database.
 * All queries are parameterised; tier gating is enforced by the frontend
 * layer which proxies through this backend.
 */

import { FastifyInstance } from "fastify";
import { query } from "../config/database";

export async function opportunitiesRoutes(fastify: FastifyInstance) {
  // GET /opportunities — list signals with optional sector/jurisdiction filtering
  fastify.get("/opportunities", async (request, reply) => {
    const { sector, jurisdiction, limit, offset } = request.query as {
      sector?: string;
      jurisdiction?: string;
      limit?: string;
      offset?: string;
    };

    let queryText = `SELECT id, title, buyer_name, jurisdiction, sector,
                            opportunity_type, estimated_value, source_name,
                            source_url, source_hash, sha256_hash,
                            commercial_why, published_at, created_at
                       FROM signals WHERE 1=1`;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (sector) {
      queryText += ` AND sector = $${paramIdx++}::signal_sector`;
      params.push(sector);
    }
    if (jurisdiction) {
      queryText += ` AND jurisdiction = $${paramIdx++}`;
      params.push(jurisdiction);
    }

    const maxPerPage = 100;
    const perPage = Math.min(
      maxPerPage,
      Math.max(1, limit ? Number(limit) : 50),
    );
    const pageOffset = offset ? Number(offset) : 0;

    queryText += ` ORDER BY published_at DESC NULLS LAST, created_at DESC
                   LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(perPage, pageOffset);

    try {
      const result = await query(queryText, params);
      return {
        status: "success",
        count: result.rows.length,
        data: result.rows,
        perPage,
        offset: pageOffset,
      };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to list opportunities.",
      });
    }
  });

  // GET /opportunities/:id — single signal detail
  fastify.get("/opportunities/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await query(
        `SELECT id, title, buyer_name, jurisdiction, sector,
                opportunity_type, estimated_value, source_name, source_url,
                source_hash, sha256_hash, commercial_why, published_at,
                created_at
           FROM signals WHERE id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "Opportunity not found" });
      }
      return { status: "success", data: result.rows[0] };
    } catch (err: unknown) {
      fastify.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : "Failed to load opportunity.",
      });
    }
  });

  // Health alias
  fastify.get("/health", async () => ({
    status: "ok",
    service: "sourcesignal-backend",
  }));

  // Coverage matrix
  fastify.get("/coverage", async () => ({
    status: "success",
    sectors: 15,
    activeAdapters: 9,
    jurisdictions: ["UK", "US", "EU"],
  }));
}
