import { entitlementsFor } from "@/lib/entitlements";
import { ProfilePageClient } from "@/components/dashboard-profile-client";
import { getSessionContext } from "@/lib/backend";

export default async function ProfilePage() {
  const { planId, user } = await getSessionContext();
  const entitlements = entitlementsFor(planId);

  return (
    <ProfilePageClient
      initialPlanId={planId}
      initialEntitlements={entitlements}
      user={user}
    />
  );
}
