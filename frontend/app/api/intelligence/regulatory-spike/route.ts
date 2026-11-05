/**
 * Regulatory Spike API.
 *
 * GET /api/intelligence/regulatory-spike
 *
 * Returns regulatory spike analysis for all sectors — correlates tender
 * volumes with upcoming regulatory deadlines to explain macro spending
 * waves and surface budget flush indicators.
 *
 * Pro tier only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getRegulatorySpikes } from "@/lib/regulatory-spike";

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requirePro(request);
  if (authResult) return authResult;

  try {
    const spikes = await getRegulatorySpikes();
    return NextResponse.json(spikes);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Regulatory spike lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
