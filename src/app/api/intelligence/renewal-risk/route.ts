/**
 * Pre-Tender Renewal Risk API.
 *
 * GET /api/intelligence/renewal-risk?canonicalId=...&closingDate=...
 *
 * Returns pre-tender renewal risk assessment for a specific opportunity,
 * including days until expiry and historical re-tender pattern warnings.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPreTenderRisk } from "@/lib/historical-intelligence";

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const canonicalId = searchParams.get("canonicalId");
  const closingDate = searchParams.get("closingDate") || undefined;

  if (!canonicalId) {
    return NextResponse.json(
      { error: "canonicalId is required." },
      { status: 400 },
    );
  }

  try {
    const risk = await getPreTenderRisk(canonicalId, closingDate);
    if (!risk) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(risk);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Renewal risk lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
