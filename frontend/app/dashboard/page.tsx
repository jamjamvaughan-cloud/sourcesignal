import type { Metadata } from "next";
import { backendJson, getSessionContext } from "@/lib/backend";
import { entitlementsFor } from "@/lib/entitlements";
import { PRIMARY_SOURCES_MONITORED_LABEL } from "@/lib/ingestion/sources";
import {
  DashboardWorkspace,
  type DashboardOpportunity,
} from "./dashboard-workspace";

export const metadata: Metadata = {
  title: "Commercial Signal Feed | SourceSignal",
  description:
    "Industrial commercial opportunity engine — real-time opportunity signals the second they drop.",
};

interface SignalsResponse {
  items?: DashboardOpportunity[];
  total?: number;
  page?: number;
  perPage?: number;
  hasMore?: boolean;
}

async function fetchSignals(
  userCountry: string | null,
): Promise<DashboardOpportunity[]> {
  const params = new URLSearchParams({
    page: "1",
    perPage: "100",
  });
  if (userCountry) {
    params.set("region", userCountry);
  }

  const result = await backendJson<SignalsResponse>(
    `/api/signals?${params.toString()}`,
  );

  return result?.items ?? [];
}

export default async function DashboardPage() {
  const { user, planId } = await getSessionContext();
  const entitlements = entitlementsFor(planId);
  const isPro = entitlements.fullDetailsEnabled || entitlements.alertsEnabled;
  const signals = await fetchSignals(user?.country ?? null);

  return (
    <DashboardWorkspace
      opportunities={signals}
      primarySourcesLabel={PRIMARY_SOURCES_MONITORED_LABEL}
      isPro={isPro}
    />
  );
}
