/**
 * Sector Momentum API.
 *
 * GET /api/intelligence/sector-momentum?sector=...&country=...
 *
 * Returns cross-border sector momentum scores comparing current period
 * signal counts vs baseline per country x sector.
 *
 * Pro tier only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getSectorMomentum } from "@/lib/historical-intelligence";
import type { CountryCode } from "@/types";

async function requirePro(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  if (!entitlements.fullDetailsEnabled) {
    return NextResponse.json(
      { error: "Pro tier subscription required" },
      { status: 403 },
    );
  }

  return null;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const authResult = await requirePro(request);
  if (authResult) return authResult;

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
