/**
 * Spatial Radar Map API.
 *
 * GET /api/map/signals?west=&south=&east=&north=
 *
 * Returns all signals whose latitude/longitude fall within the supplied
 * viewport bounding box, plus an aggregated pipeline stat block for the
 * floating "£XM Active Pipeline in Selected Coordinates" overlay.
 *
 * Requires an authenticated session. Free-tier callers are restricted to
 * their signup jurisdiction.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { getUserPlanId } from "@/lib/auth";

const JURISDICTION_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  UK: { lat: 54.0, lon: -2.0 },
  US: { lat: 39.8, lon: -98.6 },
  EU: { lat: 50.1, lon: 10.5 },
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  const { searchParams } = new URL(request.url);
  const west = Number(searchParams.get("west"));
  const south = Number(searchParams.get("south"));
  const east = Number(searchParams.get("east"));
  const north = Number(searchParams.get("north"));

  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return NextResponse.json(
      { error: "west, south, east and north parameters are required." },
      { status: 400 },
    );
  }

  // Free-tier users are locked to their signup jurisdiction.
  const jurisdiction = entitlements.fullDetailsEnabled
    ? undefined
    : user.country ?? undefined;

  const conditions: string[] = [
    "latitude IS NOT NULL AND longitude IS NOT NULL",
    "latitude >= $1 AND latitude <= $2",
    "longitude >= $3 AND longitude <= $4",
  ];
  const params: unknown[] = [south, north, west, east];
  let paramIndex = 5;

  if (jurisdiction) {
    conditions.push(`jurisdiction = $${paramIndex++}`);
    params.push(jurisdiction);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  // Fetch the raw rows for rendering pins/clusters.
  const rowsResult = await query(
    `SELECT id, title, buyer_name, jurisdiction, sector, opportunity_type,
            estimated_value, latitude, longitude, source_name, source_url,
            sha256_hash, commercial_why, published_at
       FROM signals
       ${where}
       ORDER BY estimated_value DESC NULLS LAST, published_at DESC
       LIMIT 500`,
    params,
  );

  const rows = rowsResult.rows;

  // Aggregate pipeline stats for the floating overlay.
  let totalValue = 0;
  let signalCount = 0;
  const byTier: Record<string, number> = {};

  for (const row of rows) {
    signalCount++;
    const value = Number(row.estimated_value);
    if (Number.isFinite(value) && value > 0) {
      totalValue += value;
    }
    const tier = String(row.opportunity_type ?? "UNKNOWN");
    byTier[tier] = (byTier[tier] ?? 0) + 1;
  }

  const formatMoney = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `£${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `£${Math.round(value / 1_000)}K`;
    return `£${Math.round(value)}`;
  };

  return NextResponse.json({
    bbox: { west, south, east, north },
    count: rows.length,
    totalValue,
    totalValueFormatted: formatMoney(totalValue),
    signalCount,
    byTier,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      buyer: row.buyer_name,
      jurisdiction: row.jurisdiction,
      sector: row.sector,
      opportunity_type: row.opportunity_type,
      estimated_value: row.estimated_value,
      latitude: row.latitude,
      longitude: row.longitude,
      source_name: row.source_name,
      source_url: row.source_url,
      sha256_hash: row.sha256_hash,
      commercial_why: row.commercial_why,
      published_at: row.published_at,
    })),
  });
}
