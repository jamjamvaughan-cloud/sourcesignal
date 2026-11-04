/**
 * Single opportunity (signal) API route.
 *
 * GET /api/opportunities/:id
 *
 * Requires an authenticated session. Free-tier callers are restricted to
 * their signup country and the 24-hour embargo, and receive redacted fields.
 */

import { NextResponse } from "next/server";
import { getOpportunity } from "@/lib/opportunities";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { error } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  // Free accounts are locked to their signup country; fail closed when none
  // is stored rather than exposing a globally-scoped detail record.
  if (!entitlements.fullDetailsEnabled && !user.country) {
    return NextResponse.json(
      { error: "Opportunity not found." },
      { status: 404 },
    );
  }

  try {
    const opportunity = await getOpportunity(id, entitlements, {
      jurisdiction: entitlements.fullDetailsEnabled ? null : user.country,
    });
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
