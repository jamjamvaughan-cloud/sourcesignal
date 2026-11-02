/**
 * Sector Momentum API.
 *
 * GET /api/intelligence/sector-momentum?sector=...&country=...
 *
 * Returns cross-border sector momentum scores comparing current period
 * signal counts vs baseline per country x sector.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSectorMomentum } from "@/lib/historical-intelligence";
import type { CountryCode } from "@/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const sector = searchParams.get("sector");
  const country = searchParams.get("country");

  if (!sector) {
    return NextResponse.json(
      { error: "sector is required." },
      { status: 400 },
    );
  }
  if (!country) {
    return NextResponse.json(
      { error: "country is required." },
      { status: 400 },
    );
  }

  try {
    const momentum = await getSectorMomentum(
      sector,
      country as CountryCode,
    );
    return NextResponse.json(momentum);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Sector momentum lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
