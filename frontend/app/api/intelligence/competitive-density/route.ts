/**
 * Competitive Density API.
 *
 * GET /api/intelligence/competitive-density?buyer=...
 *
 * Returns a buyer's competitive profile showing incumbent lock-in vs open
 * market signals based on 3 years of historical award data.
 *
 * Pro tier only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getBuyerCompetitiveProfile } from "@/lib/historical-intelligence";

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
