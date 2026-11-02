/**
 * Regulatory Spike Radar.
 *
 * Correlates incoming tender volumes with upcoming regulatory deadlines to
 * explain macro spending waves. Detects when buyers accelerate procurement
 * ahead of regulatory mandates (cybersecurity, carbon reporting, infrastructure
 * bills, etc.).
 *
 * Modules:
 *   1. Regulatory Deadline Tracking — known compliance deadlines by sector/country
 *   2. Spending Wave Detection — volume spikes correlated to regulatory dates
 *   3. Macro Intent Alerts — "Budget Flush" style alerts with regulatory context
 *   4. Sector Regulatory Exposure — which sectors face upcoming mandates
 */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { error, info } from "@/lib/logger";
import type { CountryCode } from "@/types";

/** Known regulatory deadlines by sector and country. */
const REGULATORY_DEADLINES: Record<
  string,
  Array<{
    country: CountryCode;
    sector: string;
    regulation: string;
    deadline: string; // ISO date
    description: string;
    impactLevel: "high" | "medium" | "low";
  }>
> = {
  "technology-infrastructure": [
    {
      country: "UK",
      sector: "technology-infrastructure",
      regulation: "NIS2 Directive (EU) / UK Cyber Security Strategy",
      deadline: "2026-10-17",
      description: "NIS2 cybersecurity compliance deadline for critical infrastructure",
      impactLevel: "high",
    },
    {
      country: "EU",
      sector: "technology-infrastructure",
      regulation: "NIS2 Directive",
      deadline: "2026-10-17",
      description: "EU NIS2 cybersecurity directive implementation deadline",
      impactLevel: "high",
    },
    {
      country: "US",
      sector: "technology-infrastructure",
      regulation: "Federal Zero Trust Architecture (OMB M-22-09)",
      deadline: "2026-09-30",
      description: "US Federal zero trust architecture implementation deadline",
      impactLevel: "high",
    },
  ],
  energy: [
    {
      country: "UK",
      sector: "energy",
      regulation: "UK Net Zero 2050 / Carbon Budgets",
      deadline: "2026-03-31",
      description: "UK carbon budget reporting deadline for energy sector",
      impactLevel: "high",
    },
    {
      country: "EU",
      sector: "energy",
      regulation: "EU Renewable Energy Directive (RED III)",
      deadline: "2026-06-30",
      description: "EU renewable energy target implementation deadline",
      impactLevel: "high",
    },
  ],
  construction: [
    {
      country: "UK",
      sector: "construction",
      regulation: "Building Safety Act 2022",
      deadline: "2026-10-01",
      description: "UK Building Safety Act full implementation deadline",
      impactLevel: "medium",
    },
  ],
  "healthcare-infrastructure": [
    {
      country: "UK",
      sector: "healthcare-infrastructure",
      regulation: "NHS Digital Health and Social Care Plan",
      deadline: "2026-03-31",
      description: "NHS digital transformation milestone deadline",
      impactLevel: "medium",
    },
  ],
  transport: [
    {
      country: "UK",
      sector: "transport",
      regulation: "UK Transport Decarbonisation Plan",
      deadline: "2026-12-31",
      description: "UK transport decarbonisation milestone",
      impactLevel: "medium",
    },
    {
      country: "EU",
      sector: "transport",
      regulation: "EU Sustainable Transport Regulation",
      deadline: "2026-12-31",
      description: "EU sustainable transport compliance deadline",
      impactLevel: "medium",
    },
  ],
  "logistics-and-distribution": [
    {
      country: "EU",
      sector: "logistics-and-distribution",
      regulation: "EU Corporate Sustainability Reporting Directive (CSRD)",
      deadline: "2026-01-01",
      description: "EU CSRD sustainability reporting deadline for large logistics firms",
      impactLevel: "high",
    },
  ],
  "public-sector-services": [
    {
      country: "UK",
      sector: "public-sector-services",
      regulation: "UK Public Sector Bodies Accessibility Regulations",
      deadline: "2026-09-23",
      description: "UK public sector accessibility compliance deadline",
      impactLevel: "medium",
    },
  ],
};

const SECTOR_DISPLAY_NAMES: Record<string, string> = {
  "technology-infrastructure": "Technology Infrastructure",
  energy: "Energy",
  construction: "Construction",
  "healthcare-infrastructure": "Healthcare Infrastructure",
  transport: "Transport",
  "logistics-and-distribution": "Logistics & Distribution",
  "public-sector-services": "Public Sector Services",
  "water-and-environment": "Water & Environment",
  "facilities-management": "Facilities Management",
  telecommunications: "Telecommunications",
  "property-and-real-estate": "Property & Real Estate",
  "defence-and-aerospace": "Defence & Aerospace",
  engineering: "Engineering",
  "industrial-and-manufacturing": "Industrial & Manufacturing",
};

/**
 * Regulatory spike assessment for a sector-country combination.
 */
interface RegulatorySpike {
  sector: string;
  country: CountryCode;
  sectorDisplayName: string;
  upcomingDeadlines: Array<{
    regulation: string;
    deadline: string;
    description: string;
    impactLevel: "high" | "medium" | "low";
    daysUntilDeadline: number;
  }>;
  tenderVolumeLast30Days: number;
  tenderVolumeLast7Days: number;
  volumeSpikePct: number;
  isRegulatorySpike: boolean;
  spikeTag: string | null;
  macroIntentAlert: string | null;
}

/**
 * Days between two ISO date strings.
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Fetch tender counts by sector and country for spike detection.
 */
async function fetchTenderCounts(
  sector: string,
  country: CountryCode,
): Promise<{ last7Days: number; last30Days: number }> {
  const pb = await getAdminPb();
  if (!pb) {
    error("regulatory_spike", {
      error: "PocketBase unavailable for regulatory spike fetch",
    });
    return { last7Days: 0, last30Days: 0 };
  }

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [recent7, recent30] = await Promise.all([
      pb.collection("opportunities").getFullList({
        filter: `sector = "${sector}" && region = "${country}" && created >= "${sevenDaysAgo}"`,
        fields: "id",
      }),
      pb.collection("opportunities").getFullList({
        filter: `sector = "${sector}" && region = "${country}" && created >= "${thirtyDaysAgo}"`,
        fields: "id",
      }),
    ]);

    return {
      last7Days: recent7.length,
      last30Days: recent30.length,
    };
  } catch (err) {
    error("regulatory_spike", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { last7Days: 0, last30Days: 0 };
  }
}

/**
 * Get regulatory spike analysis for all sectors with upcoming deadlines.
 */
export async function getRegulatorySpikes(): Promise<RegulatorySpike[]> {
  const now = new Date().toISOString();
  const spikes: RegulatorySpike[] = [];

  // Collect unique sector-country combinations with upcoming deadlines.
  const deadlineEntries: Array<{
    sector: string;
    country: CountryCode;
    deadline: {
      regulation: string;
      deadline: string;
      description: string;
      impactLevel: "high" | "medium" | "low";
      daysUntilDeadline: number;
    };
  }> = [];

  for (const [sector, deadlines] of Object.entries(REGULATORY_DEADLINES)) {
    for (const dl of deadlines) {
      const daysUntil = daysBetween(now, dl.deadline);
      // Only include deadlines within the next 180 days or already passed within 30 days.
      if (daysUntil <= 180 && daysUntil >= -30) {
        deadlineEntries.push({
          sector,
          country: dl.country,
          deadline: {
            regulation: dl.regulation,
            deadline: dl.deadline,
            description: dl.description,
            impactLevel: dl.impactLevel,
            daysUntilDeadline: daysUntil,
          },
        });
      }
    }
  }

  // Group by sector-country.
  const grouped = new Map<
    string,
    { sector: string; country: CountryCode; deadlines: typeof deadlineEntries[0]["deadline"][] }
  >();
  for (const entry of deadlineEntries) {
    const key = `${entry.sector}|${entry.country}`;
    if (!grouped.has(key)) {
      grouped.set(key, { sector: entry.sector, country: entry.country, deadlines: [] });
    }
    grouped.get(key)!.deadlines.push(entry.deadline);
  }

  for (const [, group] of grouped) {
    const { last7Days, last30Days } = await fetchTenderCounts(
      group.sector,
      group.country,
    );

    const volumeSpikePct =
      last30Days > 0
        ? Math.round(((last7Days * (30 / 7)) - last30Days) / last30Days) * 100
        : last7Days > 0
          ? 100
          : 0;

    const isRegulatorySpike =
      volumeSpikePct >= 50 || // 50%+ volume increase
      group.deadlines.some((d) => d.impactLevel === "high" && d.daysUntilDeadline <= 30);

    let spikeTag: string | null = null;
    let macroIntentAlert: string | null = null;

    if (isRegulatorySpike) {
      const nearestDeadline = group.deadlines
        .filter((d) => d.daysUntilDeadline >= 0)
        .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline)[0];

      const sectorName =
        SECTOR_DISPLAY_NAMES[group.sector] ?? group.sector;

      if (volumeSpikePct >= 50 && nearestDeadline) {
        spikeTag = `Regulatory Spike: ${sectorName} in ${group.country} — tender volume up ${volumeSpikePct}% with ${nearestDeadline.regulation} deadline in ${nearestDeadline.daysUntilDeadline} days.`;
        macroIntentAlert = `Budget Flush Detected: ${sectorName} buyers in ${group.country} accelerating procurement ahead of ${nearestDeadline.regulation} (${nearestDeadline.description}). ${last7Days} tenders in last 7 days vs ${last30Days} in last 30 days.`;
      } else if (nearestDeadline) {
        spikeTag = `Regulatory Deadline Approaching: ${sectorName} in ${group.country} — ${nearestDeadline.regulation} in ${nearestDeadline.daysUntilDeadline} days.`;
        macroIntentAlert = `Regulatory Spike: ${sectorName} buyers in ${group.country} should increase procurement ahead of ${nearestDeadline.regulation} deadline (${nearestDeadline.description}).`;
      }
    }

    spikes.push({
      sector: group.sector,
      country: group.country,
      sectorDisplayName: SECTOR_DISPLAY_NAMES[group.sector] ?? group.sector,
      upcomingDeadlines: group.deadlines,
      tenderVolumeLast30Days: last30Days,
      tenderVolumeLast7Days: last7Days,
      volumeSpikePct,
      isRegulatorySpike,
      spikeTag,
      macroIntentAlert,
    });
  }

  // Sort by risk: regulatory spikes first, then by volume spike.
  spikes.sort((a, b) => {
    if (a.isRegulatorySpike && !b.isRegulatorySpike) return -1;
    if (!a.isRegulatorySpike && b.isRegulatorySpike) return 1;
    return b.volumeSpikePct - a.volumeSpikePct;
  });

  info("regulatory_spike", {
    sectorsAnalyzed: spikes.length,
    regulatorySpikes: spikes.filter((s) => s.isRegulatorySpike).length,
  });

  return spikes;
}

export { REGULATORY_DEADLINES };
export type { RegulatorySpike };