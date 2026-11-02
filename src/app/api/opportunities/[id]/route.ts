/**
 * Single opportunity API route.
 */

import { NextResponse } from "next/server";
import { getOpportunity } from "@/lib/opportunities";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { entitlementsFor } from "@/lib/entitlements";
import type { PlanId } from "@/lib/entitlements";

async function getUserPlanId(userId: string): Promise<PlanId> {
  const pb = await getAdminPb();
  if (!pb) return "free";
  try {
    const memberships = await pb.collection("memberships").getList(1, 1, {
      filter: `user = "${userId}"`,
    });
    if (memberships.items.length === 0) return "free";
    const membership = memberships.items[0];
    const org = await pb.collection("organisations").getOne(membership.organisation);
    return ((org as Record<string, unknown>).plan as PlanId) ?? "free";
  } catch {
    return "free";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookieHeader = (request as unknown as { headers: { get: (key: string) => string | null } }).headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;

  let planId: PlanId = "free";
  if (user) {
    planId = await getUserPlanId(user.id);
  }
  const entitlements = entitlementsFor(planId);

  const opportunity = await getOpportunity(id, entitlements);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }
  return NextResponse.json({ opportunity });
}
