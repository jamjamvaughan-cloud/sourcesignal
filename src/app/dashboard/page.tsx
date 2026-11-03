import type { Metadata } from "next";
import { backendJson, getSessionContext } from "@/lib/backend";
import {
  DashboardWorkspace,
  type DashboardOpportunity,
} from "./dashboard-workspace";

export const metadata: Metadata = {
  title: "Commercial Signal Feed | SourceSignal",
  description:
    "Industrial commercial opportunity engine — real-time opportunity signals the second they drop.",
};

interface OpportunitiesResponse {
  items?: DashboardOpportunity[];
}

async function fetchOpportunities(
  userCountry: string | null,
): Promise<DashboardOpportunity[]> {
  const params = new URLSearchParams({
    page: "1",
    perPage: "100",
    sort: "-created_at",
  });
  if (userCountry) {
    params.set("country", userCountry);
  }

  const result = await backendJson<OpportunitiesResponse>(
    `/api/opportunities?${params.toString()}`,
  );

  return result?.items ?? [];
}

export default async function DashboardPage() {
  const { user } = await getSessionContext();
  const opportunities = await fetchOpportunities(user?.country ?? null);

  return <DashboardWorkspace opportunities={opportunities} />;
}
