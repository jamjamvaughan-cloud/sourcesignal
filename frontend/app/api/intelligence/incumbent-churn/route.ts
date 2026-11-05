/**
 * Incumbent Churn API.
 *
 * GET /api/intelligence/incumbent-churn
 *
 * Returns churn risk profiles for all buyers — early termination flags,
 * market testing notices, shortened renewal cycles, and "High Churn Risk"
 * accounts where entrenched competitors can be displaced.
 *
 * Pro tier only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getAllBuyerChurnProfiles } from "@/lib/incumbent-churn";

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
    const profiles = await getAllBuyerChurnProfiles();
    return NextResponse.json(profiles);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Incumbent churn lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
