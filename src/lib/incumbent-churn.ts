/**
 * Incumbent Churn Detection.
 *
 * Detects when a buyer is quietly frustrated with an incumbent supplier by
 * analyzing:
 *   1. Early contract termination flags (cancelled/aborted procurements)
 *   2. Mid-cycle market testing notices (RFIs, market sounding before expiry)
 *   3. Shortened renewal cycles (re-tendering faster than historical average)
 *   4. Winner churn (different suppliers winning sequential contracts)
 *
 * Output: "High Churn Risk" accounts where buyers can be approached to
 * displace entrenched competitors.
 */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { error, info } from "@/lib/logger";

/** Historical award record for churn analysis. */
interface ChurnAward {
  id: string;
  canonical_id: string;
  title: string;
  buyer: string | null;
  buyer_canonical_id: string | null;
  winner: string | null;
  sector: string | null;
  region: string | null;
  closing_date: string | null;
  procurement_stage: string | null;
  created: string | null;
  updated: string | null;
  detail_fields: Record<string, unknown> | null;
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
 * Fetch historical awards for churn analysis.
 */
async function fetchChurnAwards(lookbackDays: number = 3 * 365): Promise<ChurnAward[]> {
  const pb = await getAdminPb();
  if (!pb) {
    error("incumbent_churn", {
      error: "PocketBase unavailable for churn analysis fetch",
    });
    return [];
  }

  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const records = await pb.collection("opportunities").getFullList({
      filter: `created >= "${cutoffDate}" && winner != "" && winner != null`,
      fields:
        "id,canonical_id,title,buyer,buyer_canonical_id,winner,sector,region,closing_date,procurement_stage,created,updated,detail_fields",
      sort: "-created",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return records.map((item: any) => ({
      id: item.id,
      canonical_id: item.canonical_id as string,
      title: item.title as string,
      buyer: item.buyer as string | null,
      buyer_canonical_id: item.buyer_canonical_id as string | null,
      winner: item.winner as string | null,
      sector: item.sector as string | null,
      region: item.region as string | null,
      closing_date: item.closing_date as string | null,
      procurement_stage: item.procurement_stage as string | null,
      created: item.created as string | null,
      updated: item.updated as string | null,
      detail_fields: (item.detail_fields as Record<string, unknown> | null) ?? null,
    }));
  } catch (err) {
    error("incumbent_churn", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Incumbent churn profile for a buyer.
 */
export interface BuyerChurnProfile {
  buyer: string;
  buyerCanonicalId: string | null;
  totalAwards: number;
  uniqueWinners: number;
  winnerChanges: number; // times winner changed between sequential contracts
  earlyTerminations: number; // cancelled/aborted contracts
  marketTestingNotices: number; // RFIs/market sounding mid-cycle
  avgRenewalCycleDays: number | null;
  shortenedRenewalCycles: number; // cycles shorter than average
  churnRiskScore: number; // 0-100
  churnRiskLevel: "high" | "medium" | "low";
  churnTag: string | null;
  topIncumbent: string | null;
  incumbentWins: number;
  incumbentWinPct: number;
}

/**
 * Detects early termination from procurement stage or detail fields.
 */
function isEarlyTermination(record: ChurnAward): boolean {
  if (record.procurement_stage === "cancelled") return true;
  const df = record.detail_fields;
  if (df) {
    const haystack = JSON.stringify(df).toLowerCase();
    if (
      haystack.includes("terminated") ||
      haystack.includes("early termination") ||
      haystack.includes("contract ended early") ||
      haystack.includes("aborted")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detects market testing notices (RFIs, market sounding) mid-cycle.
 */
function isMarketTesting(record: ChurnAward): boolean {
  const haystack = `${record.title}`.toLowerCase();
  const testingKeywords = [
    "request for information",
    "rfi",
    "market sounding",
    "soft market testing",
    "market consultation",
    "pre-market engagement",
    "expression of interest",
  ];
  return testingKeywords.some((kw) => haystack.includes(kw));
}

/**
 * Analyzes incumbent churn for all buyers with sufficient history.
 */
export async function getAllBuyerChurnProfiles(): Promise<BuyerChurnProfile[]> {
  const awards = await fetchChurnAwards();
  const now = new Date().toISOString();

  // Group awards by buyer canonical ID (fall back to raw buyer name).
  const buyerGroups = new Map<string, ChurnAward[]>();
  for (const award of awards) {
    const key = award.buyer_canonical_id ?? award.buyer ?? "unknown";
    if (!buyerGroups.has(key)) {
      buyerGroups.set(key, []);
    }
    buyerGroups.get(key)!.push(award);
  }

  const profiles: BuyerChurnProfile[] = [];

  for (const [buyerKey, buyerAwards] of buyerGroups) {
    if (buyerAwards.length < 2) continue; // Need at least 2 awards for churn analysis

    const buyerName = buyerAwards[0].buyer ?? buyerKey;
    const buyerCanonicalId = buyerAwards[0].buyer_canonical_id ?? null;

    // Count unique winners.
    const winners = new Set<string>();
    let incumbentWins = 0;
    let topIncumbent: string | null = null;
    let incumbentWinPct = 0;

    const winnerCounts = new Map<string, number>();
    for (const award of buyerAwards) {
      if (award.winner) {
        winners.add(award.winner);
        winnerCounts.set(award.winner, (winnerCounts.get(award.winner) ?? 0) + 1);
      }
    }

    // Find top incumbent.
    for (const [winner, count] of winnerCounts) {
      if (!topIncumbent || count > (winnerCounts.get(topIncumbent) ?? 0)) {
        topIncumbent = winner;
      }
    }
    incumbentWins = winnerCounts.get(topIncumbent ?? "") ?? 0;
    incumbentWinPct = buyerAwards.length > 0 ? (incumbentWins / buyerAwards.length) * 100 : 0;

    // Count early terminations.
    const earlyTerminations = buyerAwards.filter(isEarlyTermination).length;

    // Count market testing notices.
    const marketTestingNotices = buyerAwards.filter(isMarketTesting).length;

    // Calculate winner changes (sequential contracts with different winners).
    const sortedByDate = [...buyerAwards].sort(
      (a, b) =>
        new Date(a.created ?? now).getTime() - new Date(b.created ?? now).getTime(),
    );
    let winnerChanges = 0;
    let lastWinner: string | null = null;
    for (const award of sortedByDate) {
      if (lastWinner && award.winner && award.winner !== lastWinner) {
        winnerChanges++;
      }
      if (award.winner) lastWinner = award.winner;
    }

    // Calculate average renewal cycle and detect shortened cycles.
    const cycles: number[] = [];
    for (let i = 1; i < sortedByDate.length; i++) {
      const prev = sortedByDate[i - 1];
      const curr = sortedByDate[i];
      if (prev.closing_date && curr.closing_date) {
        cycles.push(daysBetween(prev.closing_date, curr.closing_date));
      }
    }
    const avgRenewalCycleDays =
      cycles.length > 0
        ? cycles.reduce((sum, d) => sum + d, 0) / cycles.length
        : null;
    const shortenedRenewalCycles = avgRenewalCycleDays
      ? cycles.filter((d) => d < avgRenewalCycleDays * 0.8).length
      : 0;

    // Calculate churn risk score (0-100).
    let churnRiskScore = 0;

    // Early terminations are strong churn indicators (up to 30 points).
    churnRiskScore += Math.min(
      (earlyTerminations / buyerAwards.length) * 30,
      30,
    );

    // Winner changes indicate churn (up to 25 points).
    churnRiskScore += Math.min(
      (winnerChanges / Math.max(buyerAwards.length - 1, 1)) * 25,
      25,
    );

    // Market testing notices indicate churn exploration (up to 20 points).
    churnRiskScore += Math.min(
      (marketTestingNotices / buyerAwards.length) * 20,
      20,
    );

    // Shortened renewal cycles indicate impatience (up to 15 points).
    churnRiskScore += Math.min(
      (shortenedRenewalCycles / Math.max(cycles.length, 1)) * 15,
      15,
    );

    // Low incumbent win % indicates openness to change (up to 10 points).
    if (incumbentWinPct < 50) {
      churnRiskScore += 10;
    }

    churnRiskScore = Math.round(Math.min(churnRiskScore, 100));

    let churnRiskLevel: "high" | "medium" | "low" = "low";
    if (churnRiskScore >= 70) churnRiskLevel = "high";
    else if (churnRiskScore >= 40) churnRiskLevel = "medium";

    let churnTag: string | null = null;
    if (churnRiskLevel === "high") {
      churnTag = `High Churn Risk: "${buyerName}" — ${earlyTerminations} early terminations, ${winnerChanges} winner changes, ${marketTestingNotices} market testing notices. Incumbent "${topIncumbent}" at risk of displacement.`;
    } else if (churnRiskLevel === "medium") {
      churnTag = `Churn Watch: "${buyerName}" — showing signs of supplier dissatisfaction. ${earlyTerminations} early termination(s), ${marketTestingNotices} market testing notice(s).`;
    }

    profiles.push({
      buyer: buyerName,
      buyerCanonicalId,
      totalAwards: buyerAwards.length,
      uniqueWinners: winners.size,
      winnerChanges,
      earlyTerminations,
      marketTestingNotices,
      avgRenewalCycleDays: avgRenewalCycleDays
        ? Math.round(avgRenewalCycleDays)
        : null,
      shortenedRenewalCycles,
      churnRiskScore,
      churnRiskLevel,
      churnTag,
      topIncumbent,
      incumbentWins,
      incumbentWinPct: Math.round(incumbentWinPct),
    });
  }

  // Sort by churn risk score descending.
  profiles.sort((a, b) => b.churnRiskScore - a.churnRiskScore);

  info("incumbent_churn", {
    buyersAnalyzed: profiles.length,
    highRisk: profiles.filter((p) => p.churnRiskLevel === "high").length,
  });

  return profiles;
}

export {
  fetchChurnAwards,
  isEarlyTermination,
  isMarketTesting,
};
export type { ChurnAward };
