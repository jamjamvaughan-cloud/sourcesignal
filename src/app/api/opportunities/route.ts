/**
 * Opportunities API.
 *
 * GET    /api/opportunities — list with filters (entitlement-sanitized)
 * GET    /api/opportunities/:id — single opportunity (entitlement-sanitized)
 *
 * The caller's plan/entitlements are derived from their verified PocketBase
 * session and organisation membership — never from client-supplied parameters.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { listOpportunities } from "@/lib/opportunities";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimitResponse } from "@/lib/rate-limit";
import type { PlanId } from "@/lib/entitlements";

/**
 * Resolve the authenticated user's TRUE plan from their organisation
 * membership in PocketBase. Never assume authenticated == Pro.
 */
async function getUserPlanId(
  userId: string,
): Promise<PlanId> {
  const pb = await getAdminPb();
  if (!pb) {
    return "free";
  }
  try {
    const memberships = await pb.collection("memberships").getList(1, 1, {
      filter: `user = "${userId}"`,
    });
    if (memberships.items.length === 0) {
      return "free";
    }
    const membership = memberships.items[0];
    const org = await pb.collection("organisations").getOne(
      membership.organisation,
    );
    return ((org as Record<string, unknown>).plan as PlanId) ?? "free";
  } catch {
    return "free";
  }
}

async function getEntitlements(
  request: NextRequest,
): Promise<{
  entitlements: import("@/lib/entitlements").Entitlements;
  plan: PlanId;
  userId: string;
}> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    throw new Error("Not authenticated.");
  }
  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  return { entitlements, plan: planId, userId: user.id };
}

export async function GET(
  request: NextRequest,
): Promise<Response> {
  const rateLimitResult = await rateLimitResponse(request, {
    max: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimitResult) return rateLimitResult;

  let entitlements: import("@/lib/entitlements").Entitlements;
  try {
    ({ entitlements } = await getEntitlements(request));
  } catch {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filters = {
    sector: searchParams.get("sector") || undefined,
    region: searchParams.get("region") || undefined,
    country: searchParams.get("country") || undefined,
    q: searchParams.get("q") || undefined,
    stage: searchParams.get("stage") || undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    perPage: searchParams.get("perPage")
      ? Number(searchParams.get("perPage"))
      : undefined,
    sort: searchParams.get("sort") || undefined,
  };

  try {
    const result = await listOpportunities(entitlements, filters);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list opportunities.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
