/**
 * Competitive Density API.
 *
 * GET /api/intelligence/competitive-density?buyer=...
 *
 * Returns a buyer's competitive profile showing incumbent lock-in vs open
 * market signals based on 3 years of historical award data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBuyerCompetitiveProfile } from "@/lib/historical-intelligence";

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const buyer = searchParams.get("buyer");

  if (!buyer) {
    return NextResponse.json(
      { error: "buyer is required." },
      { status: 400 },
    );
  }

  try {
    const profile = await getBuyerCompetitiveProfile(buyer);
    return NextResponse.json(profile);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Competitive density lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
