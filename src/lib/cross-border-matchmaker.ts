/**
 * Cross-Border Buyer Matchmaker.
 *
 * Spots patterns globally across borders by:
 *   1. Matching RFP/tender structures across countries
 *   2. Mapping equivalent buyers across jurisdictions (e.g., UK Manchester ↔ AU Sydney)
 *   3. Detecting pattern replication (e.g., AU transport agencies replicating UK Manchester RFP structure)
 *
 * Output: Cross-border intelligence that lets enterprises take a winning
 * sales pitch from one country and proactively pitch it to equivalent buyers
 * in other countries before local competitors spot the trend.
 */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { error, info } from "@/lib/logger";
import type { CountryCode } from "@/types";

/** Cross-border buyer equivalence mapping. */
const BUYER_EQUIVALENCE_MAP: Record<
  string,
  Array<{ country: CountryCode; buyer: string; buyerType: string }>
> = {
  "uk-manchester-city-council": [
    { country: "AU", buyer: "City of Sydney Council", buyerType: "municipal" },
    { country: "CA", buyer: "City of Toronto", buyerType: "municipal" },
    { country: "US", buyer: "City of Austin", buyerType: "municipal" },
    { country: "IE", buyer: "Dublin City Council", buyerType: "municipal" },
  ],
  "uk-transport-for-london": [
    { country: "AU", buyer: "Transport for NSW", buyerType: "transport_agency" },
    { country: "CA", buyer: "Metrolinx", buyerType: "transport_agency" },
    { country: "US", buyer: "MTA (Metropolitan Transportation Authority)", buyerType: "transport_agency" },
    { country: "IE", buyer: "Transport Infrastructure Ireland (TII)", buyerType: "transport_agency" },
  ],
  "uk-nhs-england": [
    { country: "AU", buyer: "Australian Department of Health", buyerType: "health_agency" },
    { country: "CA", buyer: "Health Canada", buyerType: "health_agency" },
    { country: "US", buyer: "Centers for Medicare & Medicaid Services (CMS)", buyerType: "health_agency" },
    { country: "IE", buyer: "Health Service Executive (HSE)", buyerType: "health_agency" },
  ],
  "uk-department-for-transport": [
    { country: "AU", buyer: "Australian Department of Infrastructure", buyerType: "transport_agency" },
    { country: "CA", buyer: "Transport Canada", buyerType: "transport_agency" },
    { country: "US", buyer: "US Department of Transportation (USDOT)", buyerType: "transport_agency" },
    { country: "IE", buyer: "Department of Transport (Ireland)", buyerType: "transport_agency" },
  ],
  "uk-crown-commercial-service": [
    { country: "AU", buyer: "Australian Department of Finance", buyerType: "procurement_agency" },
    { country: "CA", buyer: "Public Services and Procurement Canada", buyerType: "procurement_agency" },
    { country: "US", buyer: "US General Services Administration (GSA)", buyerType: "procurement_agency" },
    { country: "IE", buyer: "Office of Government Procurement (OGP)", buyerType: "procurement_agency" },
  ],
};

/**
 * RFP structure similarity keywords. These indicate similar procurement
 * structures across borders.
 */
const RFP_STRUCTURE_KEYWORDS = [
  "smart transit",
  "intelligent transport",
  "digital transformation",
  "cyber security",
  "cybersecurity",
  "carbon reduction",
  "net zero",
  "energy efficiency",
  "cloud migration",
  "data centre",
  "datacenter",
  "electronic health record",
  "EHR",
  "patient management",
  "road maintenance",
  "bridge replacement",
  "flood defence",
  "flood defense",
  "waste management",
  "recycling",
  "street lighting",
  "LED lighting",
  "smart city",
  "IoT",
  "broadband",
  "fibre",
  "fiber",
  "5G",
];

/**
 * Cross-border match result.
 */
interface CrossBorderMatch {
  sourceBuyer: string;
  sourceCountry: CountryCode;
  sourceSector: string;
  sourceOpportunityId: string;
  sourceTitle: string;
  equivalentBuyers: Array<{
    country: CountryCode;
    buyer: string;
    buyerType: string;
    confidence: number; // 0-100
  }>;
  rfpStructureSimilarity: string[]; // matched keywords
  patternReplication: boolean;
  matchTag: string | null;
  crossBorderAlert: string | null;
}

/**
 * Normalise buyer name to equivalence map key.
 */
function normaliseBuyerKey(buyerName: string | undefined | null): string | null {
  if (!buyerName) return null;
  const normalized = buyerName.toLowerCase().trim();
  const keyMap: Record<string, string> = {
    "manchester city council": "uk-manchester-city-council",
    "manchester": "uk-manchester-city-council",
    "transport for london": "uk-transport-for-london",
    "tfl": "uk-transport-for-london",
    "nhs england": "uk-nhs-england",
    "nhs": "uk-nhs-england",
    "department for transport": "uk-department-for-transport",
    "dft": "uk-department-for-transport",
    "crown commercial service": "uk-crown-commercial-service",
    "ccs": "uk-crown-commercial-service",
  };
  for (const [key, value] of Object.entries(keyMap)) {
    if (normalized.includes(key)) return value;
  }
  return null;
}

/**
 * Detect RFP structure keywords in title/summary.
 */
function detectRFPStructure(title: string | undefined, summary: string | undefined | null): string[] {
  const haystack = `${title ?? ""} ${summary ?? ""}`.toLowerCase();
  return RFP_STRUCTURE_KEYWORDS.filter((kw) => haystack.includes(kw));
}

/**
 * Fetch recent opportunities for cross-border pattern matching.
 */
async function fetchRecentOpportunities(lookbackDays: number = 90): Promise<Array<{
  id: string;
  canonical_id: string;
  title: string;
  summary: string | null;
  buyer: string | null;
  buyer_canonical_id: string | null;
  sector: string | null;
  region: string | null;
  created: string | null;
}>> {
  const pb = await getAdminPb();
  if (!pb) {
    error("cross_border_matchmaker", {
      error: "PocketBase unavailable for cross-border match fetch",
    });
    return [];
  }

  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const records = await pb.collection("opportunities").getFullList({
      filter: `created >= "${cutoffDate}"`,
      fields:
        "id,canonical_id,title,summary,buyer,buyer_canonical_id,sector,region,created",
      sort: "-created",
      limit: 500,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return records.map((item: any) => ({
      id: item.id,
      canonical_id: item.canonical_id as string,
      title: item.title as string,
      summary: item.summary as string | null,
      buyer: item.buyer as string | null,
      buyer_canonical_id: item.buyer_canonical_id as string | null,
      sector: item.sector as string | null,
      region: item.region as string | null,
      created: item.created as string | null,
    }));
  } catch (err) {
    error("cross_border_matchmaker", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Get cross-border matches for all recent opportunities.
 * Identifies pattern replication and equivalent buyer mappings across borders.
 */
export async function getCrossBorderMatches(): Promise<CrossBorderMatch[]> {
  const opportunities = await fetchRecentOpportunities();
  const matches: CrossBorderMatch[] = [];

  // Group opportunities by source buyer equivalence key.
  const bySourceBuyer = new Map<string, Array<typeof opportunities[0]>>();
  for (const opp of opportunities) {
    const key = normaliseBuyerKey(opp.buyer);
    if (!key) continue;
    if (!bySourceBuyer.has(key)) {
      bySourceBuyer.set(key, []);
    }
    bySourceBuyer.get(key)!.push(opp);
  }

  for (const [sourceKey, sourceOpportunities] of bySourceBuyer) {
    const equivalents = BUYER_EQUIVALENCE_MAP[sourceKey];
    if (!equivalents) continue;

    const sourceOpp = sourceOpportunities[0]; // Use most recent
    const rfpStructure = detectRFPStructure(sourceOpp.title, sourceOpp.summary);

    for (const equiv of equivalents) {
      // Check if there are recent opportunities from the equivalent buyer
      // in the target country (pattern replication detection).
      const targetCountryOpps = opportunities.filter(
        (o) => o.region === equiv.country || o.buyer?.toLowerCase().includes(equiv.buyer.toLowerCase()),
      );

      const patternReplication = targetCountryOpps.length > 0 && rfpStructure.length > 0;

      const confidence = Math.min(
        40 + (rfpStructure.length * 10) + (patternReplication ? 30 : 0),
        100,
      );

      let matchTag: string | null = null;
      let crossBorderAlert: string | null = null;

      if (patternReplication) {
        matchTag = `Cross-Border Pattern: "${sourceOpp.title}" (${sourceOpp.region}) — similar RFP structure detected in ${equiv.country} (${equiv.buyer}).`;
        crossBorderAlert = `Cross-Border Opportunity: Winning pitch for "${sourceOpp.title}" in ${sourceOpp.region} can be replicated for ${equiv.buyer} (${equiv.country}) — same ${rfpStructure.join(", ")} structure.`;
      } else if (confidence >= 60) {
        matchTag = `Cross-Border Match: "${sourceOpp.title}" maps to ${equiv.buyer} (${equiv.country}) — equivalent ${equiv.buyerType} buyer.`;
        crossBorderAlert = `Proactive Pitch: "${sourceOpp.title}" success in ${sourceOpp.region} can be pitched to ${equiv.buyer} in ${equiv.country} before local competitors.`;
      }

      if (matchTag) {
        matches.push({
          sourceBuyer: sourceOpp.buyer ?? sourceKey,
          sourceCountry: sourceOpp.region as CountryCode,
          sourceSector: sourceOpp.sector ?? "",
          sourceOpportunityId: sourceOpp.canonical_id,
          sourceTitle: sourceOpp.title,
          equivalentBuyers: [{
            country: equiv.country,
            buyer: equiv.buyer,
            buyerType: equiv.buyerType,
            confidence,
          }],
          rfpStructureSimilarity: rfpStructure,
          patternReplication,
          matchTag,
          crossBorderAlert,
        });
      }
    }
  }

  // Sort by confidence descending.
  matches.sort((a, b) => {
    const aConf = a.equivalentBuyers[0]?.confidence ?? 0;
    const bConf = b.equivalentBuyers[0]?.confidence ?? 0;
    return bConf - aConf;
  });

  info("cross_border_matchmaker", {
    matchesFound: matches.length,
    patternReplications: matches.filter((m) => m.patternReplication).length,
  });

  return matches;
}

export { BUYER_EQUIVALENCE_MAP, normaliseBuyerKey, detectRFPStructure };
export type { CrossBorderMatch };