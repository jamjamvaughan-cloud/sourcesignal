/**
 * Inbound Webhook Receiver.
 *
 * POST /api/webhooks/receive
 *
 * Receives real-time procurement signal pushes from source portals or
 * enterprise clients that support direct HTTP webhook delivery.
 *
 * Verifies HMAC-SHA256 signature using WEBHOOK_SIGNING_SECRET to prevent
 * unauthorized injection, then normalizes and inserts the signal into
 * PocketBase with sub-second latency (0-2s end-to-end).
 *
 * Body: { country, sourceId, title, sector, region, sourceUrl, ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { computeSignalAndNormalize } from "@/lib/signals-engine";
import { error, info } from "@/lib/logger";
import { query } from "@/lib/db";
import {
  matchSignalToRules,
  resolveOrCreateEntity,
} from "@/lib/entity-resolution";
import type { CountryCode } from "@/types";

const SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET;

/**
 * Verifies the HMAC-SHA256 signature on the incoming webhook payload.
 * The signature is sent as the `x-sourcesignal-signature` header in the
 * format `t=timestamp,v1=hex-signature`.
 */
function verifySignature(
  payload: string,
  signature: string | null,
): boolean {
  if (!SIGNING_SECRET || !signature) return false;

  // Parse the signature header: t=timestamp,v1=hex
  const parts = signature.split(",");
  let timestamp = "";
  let receivedSig = "";
  for (const part of parts) {
    const [key, ...valueParts] = part.split("=");
    const value = valueParts.join("=");
    if (key === "t") timestamp = value;
    if (key === "v1") receivedSig = value;
  }

  if (!timestamp || !receivedSig) return false;

  // Tolerance: reject signatures older than 5 minutes to prevent replay attacks.
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (now - ts > 5 * 60) return false;

  const expectedSig = createHmac("sha256", SIGNING_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return timingSafeEqual(
    Buffer.from(expectedSig, "hex"),
    Buffer.from(receivedSig, "hex"),
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("x-sourcesignal-signature");

  // Read the raw body for signature verification.
  const payload = await request.text();

  if (!verifySignature(payload, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const country = (body.country ?? "UK") as CountryCode;

  // Compute signal and normalize instantly.
  const signal = await computeSignalAndNormalize(
    {
      sourceId: String(body.sourceId ?? body.id ?? ""),
      sourceName: String(body.sourceName ?? "webhook"),
      country,
      sourceUrl: String(body.sourceUrl ?? ""),
      rawPayload: body,
      fetchedAt: new Date().toISOString(),
    },
    country,
  );

  try {
    const insertResult = await query(
      `INSERT INTO opportunities (
            canonical_id, title, sector, region, location, buyer,
            estimated_value, currency, procurement_stage, published_date,
            closing_date, confidence, signal_tier, source_url, source_hash,
            source_snapshot, vulnerability_trigger, detail_fields, cpv_code,
            is_demonstration, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, false, NOW(), NOW()
          )
          RETURNING id, canonical_id`,
      [
        signal.canonicalId,
        signal.title,
        signal.sector,
        signal.region,
        signal.location ?? null,
        signal.buyer ?? null,
        signal.estimatedValue ?? null,
        signal.currency ?? null,
        signal.procurementStage ?? null,
        signal.publishedDate ?? null,
        signal.closingDate ?? null,
        signal.confidence ?? null,
        signal.signalTier,
        signal.sourceUrl,
        signal.sourceHash ?? null,
        signal.sourceSnapshot ?? null,
        signal.vulnerabilityTrigger ?? null,
        signal.detailFields ?? null,
        signal.cpvCode ?? null,
      ],
    );

    const row = insertResult.rows[0];
    const opportunityId = row.id;
    info("webhook_receive", {
      signalId: opportunityId,
      source: signal.sourceUrl,
      country: signal.countryTag,
      latency: "instant",
    });

    // Entity resolution + rule matching run asynchronously and do not
    // block the webhook response.
    void resolveOrCreateEntity({
      canonical_id: signal.canonicalId,
      buyer: signal.buyer ?? null,
      buyer_canonical_id: undefined,
      estimated_value: signal.estimatedValue,
      currency: signal.currency,
      sector: signal.sector,
      region: signal.region,
      country: signal.countryTag,
      signal_tier: signal.signalTier,
    }).then((matchResult) => {
      if (matchResult.profile) {
        return query(
          `INSERT INTO entity_profile_members (entity_profile_id, opportunity_id, match_reason, match_confidence, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [
            matchResult.profile.id,
            opportunityId,
            matchResult.matchReason,
            matchResult.matchConfidence,
          ],
        );
      }
    }).then(() => {
      return matchSignalToRules(
        null, // Match against all rules across organisations
        opportunityId,
        {
          title: signal.title,
          summary: undefined,
          buyer: signal.buyer ?? null,
          estimated_value: signal.estimatedValue,
          currency: signal.currency,
          signal_tier: signal.signalTier,
          vulnerability_trigger: signal.vulnerabilityTrigger,
          country: signal.countryTag,
        },
      );
    }).catch((err) => {
      error("webhook_receive", {
        message: "Entity resolution failed for signal",
        opportunityId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json(
      {
        success: true,
        signalId: row.id,
        latency: "instant",
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to process webhook signal.";
    error("webhook_receive", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
