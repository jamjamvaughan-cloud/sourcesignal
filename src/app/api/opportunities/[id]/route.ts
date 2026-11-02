/**
 * Single opportunity API route.
 *
 * GET /api/opportunities/:id
 *
 * Unauthenticated callers get Free-tier field sanitisation; signed-in callers
 * get their resolved plan's entitlements.
 */

import { NextResponse } from "next/server";
import { getOpportunity } from "@/lib/opportunities";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { error } from "@/lib/logger";
import type { PlanId } from "@/lib/entitlements";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;

  let planId: PlanId = "free";
  if (user) {
    planId = await getUserPlanId(user.id);
  }
  const entitlements = entitlementsFor(planId);

  try {
    const opportunity = await getOpportunity(id, entitlements);
    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ opportunity });
  } catch (err: unknown) {
    error("opportunity_detail_failed", {
      opportunityId: id,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to load this opportunity." },
      { status: 500 },
    );
  }
}
