/**
 * Single signal API route.
 *
 * GET /api/signals/:id
 *
 * Returns one canonical signal with entitlement redaction. Free-tier callers
 * are restricted to their signup country and the 24-hour embargo.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { query } from "@/lib/db";

const SECTOR_TO_TAXONOMY: Record<string, string> = {
  TECH: "technology-infrastructure",
  ENERGY: "energy",
  HEALTHCARE: "healthcare-infrastructure",
  PUBLIC_SECTOR: "public-sector-services",
  CONSTRUCTION: "construction",
  TRANSPORT: "transport",
  LOGISTICS: "logistics-and-distribution",
};

interface SignalRow {
  id: string;
  title: string | null;
  buyer_name: string | null;
  jurisdiction: string | null;
  sector: string | null;
  opportunity_type: string | null;
  estimated_value: unknown;
  source_name: string | null;
  source_url: string | null;
  source_hash: string | null;
  sha256_hash: string | null;
  commercial_why: string | null;
  published_at: string | null;
  created_at: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  const isPro = entitlements.fullDetailsEnabled || entitlements.alertsEnabled;

  const conditions = ["id = $1"];
  const values: unknown[] = [id];

  if (!isPro) {
    // Fail closed when no signup country is stored: never expose a global
    // signal detail to a Free account.
    if (!user.country) {
      return NextResponse.json({ error: "Signal not found." }, { status: 404 });
    }
    conditions.push(
      `published_at >= '2025-01-01' AND published_at <= NOW() - INTERVAL '24 hours'`,
    );
    conditions.push(`jurisdiction = $${values.length + 1}`);
    values.push(user.country);
  }

  try {
    const result = await query(
      `SELECT id, title, buyer_name, jurisdiction, sector, opportunity_type,
              estimated_value, source_name, source_url, source_hash,
              sha256_hash, commercial_why, published_at, created_at
         FROM signals
        WHERE ${conditions.join(" AND ")}
        LIMIT 1`,
      values,
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Signal not found." }, { status: 404 });
    }

    const row = result.rows[0] as SignalRow;
    const numericValue = Number(row.estimated_value);

    const signal = {
      id: row.id,
      canonical_id: row.id,
      title: row.title ?? "Untitled signal",
      buyer: row.buyer_name ?? null,
      sector:
        (row.sector && SECTOR_TO_TAXONOMY[row.sector]) ?? row.sector ?? null,
      region: row.jurisdiction ?? null,
      country: row.jurisdiction ?? null,
      location: null,
      estimated_value:
        entitlements.fullDetailsEnabled &&
        Number.isFinite(numericValue) &&
        numericValue > 0
          ? numericValue
          : null,
      currency:
        entitlements.fullDetailsEnabled && Number.isFinite(numericValue)
          ? row.jurisdiction === "US"
            ? "USD"
            : row.jurisdiction === "EU"
              ? "EUR"
              : "GBP"
          : null,
      procurement_stage: null,
      published_date: row.published_at,
      closing_date: null,
      confidence: null,
      signal_tier: null,
      source_url: row.source_url ?? null,
      source_name: row.source_name ?? null,
      source_captured_at: row.created_at ?? null,
      source_hash: row.source_hash ?? null,
      sha256_hash: row.sha256_hash ?? null,
      summary: null,
      is_demonstration: false,
      created_at: row.created_at ?? null,
      updated_at: null,
      vulnerability_trigger: null,
      winner: null,
      opportunity_score: null,
      opportunity_type: row.opportunity_type ?? null,
      commercial_why: isPro ? (row.commercial_why ?? null) : null,
      supplier_capabilities: null,
      sub_category: null,
    };

    return NextResponse.json({ signal, isPro });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unable to load this signal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
