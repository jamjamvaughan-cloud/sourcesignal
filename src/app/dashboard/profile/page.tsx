import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlanIdFromPB } from "@/lib/auth";
import { type PlanId } from "@/lib/entitlements";
import { entitlementsFor } from "@/lib/entitlements";
import { ProfilePageClient } from "@/components/dashboard-profile-client";

async function getUserPlanId(): Promise<PlanId> {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) return "free";
  return getUserPlanIdFromPB(user.id);
}

export default async function ProfilePage() {
  const planId = await getUserPlanId();
  const entitlements = entitlementsFor(planId);
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;

  return (
    <ProfilePageClient
      initialPlanId={planId}
      initialEntitlements={entitlements}
      user={user ?? null}
    />
  );
}
