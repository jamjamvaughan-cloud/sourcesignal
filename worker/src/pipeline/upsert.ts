/**
 * Upsert pipeline stage.
 *
 * Writes normalised, canonicalised opportunities into PostgreSQL
 * (via PgBouncer on port 6432) idempotently.
 *
 * Every ingested record carries an immutable SHA-256 source hash (provenance)
 * and CPV code for traceability.
 *
 * The hard filter is applied in the normalise stage before records reach
 * this function, so only commercially actionable opportunities are written.
 */

import { Pool } from "pg";
import type { NormalisedOpportunity } from "@/types";

/**
 * PostgreSQL pool for the ingestion worker. Created lazily on first use.
 */
let poolInstance: Pool | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. The worker requires a PostgreSQL connection string.",
      );
    }
    poolInstance = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
  }
  return poolInstance;
}

/**
 * Upserts a single opportunity into PostgreSQL.
 * Uses canonical_id as the unique key for idempotent updates.
 *
 * Provenance: source_hash (SHA-256 of source snapshot) is stored on every
 * record. CPV code is preserved in detail_fields for traceability.
 *
 * Returns { inserted, updated }.
 */
export async function upsertOpportunity(
  opportunity: NormalisedOpportunity,
): Promise<{ inserted: boolean; updated: boolean }> {
  const detailFields = {
    ...(opportunity.detailFields ?? {}),
    ...(opportunity.cpvCode ? { cpv_code: opportunity.cpvCode } : {}),
    ...(opportunity.subcontractors ? { subcontractors: opportunity.subcontractors } : {}),
    ...(opportunity.winningBidder ? { winning_bidder: opportunity.winningBidder } : {}),
    ...(opportunity.estimatedExpiryDate ? { estimated_expiry_date: opportunity.estimatedExpiryDate } : {}),
    ...(opportunity.incumbentWinner ? { incumbent_winner: opportunity.incumbentWinner } : {}),
  };

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Try to find existing record by canonical_id.
    const existing = await client.query(
      `SELECT id, source_hash FROM opportunities WHERE canonical_id = $1`,
      [opportunity.canonicalId],
    );

    if (existing.rows.length > 0) {
      const existingRow = existing.rows[0];
      // Only update if source hash changed (record was modified).
      if (existingRow.source_hash === opportunity.sourceHash) {
        await client.query("COMMIT");
        return { inserted: false, updated: false };
      }
      await client.query(
        `UPDATE opportunities
          SET title = $1, summary = $2, buyer = $3, sector = $4,
              sub_category = $5, opportunity_type = $6,
              region = $7, location = $8, latitude = $9, longitude = $10,
              published_date = $11, closing_date = $12,
              estimated_value = $13, currency = $14,
              procurement_stage = $15, source_url = $16,
              source_hash = $17, confidence = $18,
              detail_fields = $19, signal_tier = $20,
              is_demonstration = $21,
              vulnerability_trigger = $22,
              source_captured_at = $23,
              updated_at = NOW()
          WHERE id = $24`,
        [
          opportunity.title,
          opportunity.summary ?? null,
          opportunity.buyer ?? null,
          opportunity.sector,
          opportunity.subCategory ?? null,
          opportunity.opportunityType ?? null,
          opportunity.region,
          opportunity.location ?? null,
          opportunity.latitude ?? null,
          opportunity.longitude ?? null,
          opportunity.publishedDate ?? null,
          opportunity.closingDate ?? null,
          opportunity.estimatedValue ?? null,
          opportunity.currency ?? null,
          opportunity.procurementStage ?? null,
          opportunity.sourceUrl ?? null,
          opportunity.sourceHash ?? null,
          opportunity.confidence ?? null,
          JSON.stringify(detailFields),
          opportunity.signalTier ?? null,
          opportunity.sourceUrl.includes("demo.sourcesignal.example"),
          opportunity.vulnerabilityTrigger ?? null,
          new Date().toISOString(),
          existingRow.id,
        ],
      );
      await client.query("COMMIT");
      return { inserted: false, updated: true };
    }

    await client.query(
      `INSERT INTO opportunities (
          canonical_id, title, summary, buyer, sector, sub_category,
          opportunity_type, region, location, latitude, longitude,
          published_date, closing_date, estimated_value, currency,
          procurement_stage, source_url, source_hash, confidence,
          detail_fields, signal_tier, is_demonstration,
          vulnerability_trigger, source_captured_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )`,
      [
        opportunity.canonicalId,
        opportunity.title,
        opportunity.summary ?? null,
        opportunity.buyer ?? null,
        opportunity.sector,
        opportunity.subCategory ?? null,
        opportunity.opportunityType ?? null,
        opportunity.region,
        opportunity.location ?? null,
        opportunity.latitude ?? null,
        opportunity.longitude ?? null,
        opportunity.publishedDate ?? null,
        opportunity.closingDate ?? null,
        opportunity.estimatedValue ?? null,
        opportunity.currency ?? null,
        opportunity.procurementStage ?? null,
        opportunity.sourceUrl ?? null,
        opportunity.sourceHash ?? null,
        opportunity.confidence ?? null,
        JSON.stringify(detailFields),
        opportunity.signalTier ?? null,
        opportunity.sourceUrl.includes("demo.sourcesignal.example"),
        opportunity.vulnerabilityTrigger ?? null,
        new Date().toISOString(),
      ],
    );
    await client.query("COMMIT");
    return { inserted: true, updated: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}