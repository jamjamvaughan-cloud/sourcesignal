/**
 * Framework Runway Tracking.
 *
 * Tracks multi-year framework agreements and Prior Information Notices (PINs)
 * to surface "steal the deal" opportunities during the shaping phase — before
 * the formal specification is drafted by the incumbent.
 *
 * Modules:
 *   1. Framework Drawdown Analysis — unspent budget remaining on active frameworks
 *   2. Framework Expiry Risk — frameworks expiring within 90–180 days
 *   3. PIN Early Intent — Prior Information Notices signaling upcoming tenders
 *   4. Market Engagement Detection — buyer holding industry sessions / market sounding
 */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { error, info } from "@/lib/logger";

/** Framework drawdown record from PocketBase. */
interface FrameworkDrawdown {
  id: string;
  canonical_id: string;
  title: string;
  buyer: string | null;
  buyer_canonical_id: string | null;
  sector: string | null;
  region: string | null;
  estimated_value: number | null;
  currency: string | null;
  closing_date: string | null;
  procurement_stage: string | null;
  winner: string | null;
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
 * Fetch framework agreements and PINs from PocketBase.
 * Frameworks are identified by procurement_stage = "planned" or PIN indicators
 * in the title/summary, or detail_fields indicating framework agreements.
 */
async function fetchFrameworkRecords(): Promise<FrameworkDrawdown[]> {
  const pb = await getAdminPb();
  if (!pb) {
    error("framework_runway", {
      error: "PocketBase unavailable for framework runway fetch",
    });
    return [];
  }

  const cutoffDate = new Date(
    Date.now() - 24 * 30 * 60 * 60 * 1000,
  ).toISOString(); // 24 months lookback

  try {
    const records = await pb.collection("opportunities").getFullList({
      filter: `created >= "${cutoffDate}" && (procurement_stage = "planned" || procurement_stage = "published")`,
      fields:
        "id,canonical_id,title,buyer,buyer_canonical_id,sector,region,estimated_value,currency,closing_date,procurement_stage,winner,created,updated,detail_fields",
      sort: "-created",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return records.map((item: any) => ({
      id: item.id,
      canonical_id: item.canonical_id as string,
      title: item.title as string,
      buyer: item.buyer as string | null,
      buyer_canonical_id: item.buyer_canonical_id as string | null,
      sector: item.sector as string | null,
      region: item.region as string | null,
      estimated_value: item.estimated_value as number | null,
      currency: item.currency as string | null,
      closing_date: item.closing_date as string | null,
      procurement_stage: item.procurement_stage as string | null,
      winner: item.winner as string | null,
      created: item.created as string | null,
      updated: item.updated as string | null,
      detail_fields: (item.detail_fields as Record<string, unknown> | null) ?? null,
    }));
  } catch (err) {
    error("framework_runway", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Framework runway assessment.
 */
interface FrameworkRunway {
  /** Framework canonical ID. */
  canonicalId: string;
  /** Framework title. */
  title: string;
  /** Buyer name. */
  buyer: string | null;
  /** Canonical buyer ID. */
  buyerCanonicalId: string | null;
  /** Sector. */
  sector: string | null;
  /** Region. */
  region: string | null;
  /** Total framework value. */
  estimatedValue: number | null;
  /** Currency. */
  currency: string | null;
  /** Framework expiry date. */
  expiryDate: string | null;
  /** Days until expiry. */
  daysUntilExpiry: number | null;
  /** Unspent budget remaining (£). */
  unspentBudget: number | null;
  /** Drawdown rate (spent per month). */
  drawdownRate: number | null;
  /** Percentage of framework consumed. */
  drawdownPct: number | null;
  /** Is PIN / early intent signal. */
  isPIN: boolean;
  /** Market engagement detected. */
  marketEngagement: boolean;
  /** Runway risk tag. */
  runwayTag: string | null;
  /** Runway risk level: "high" | "medium" | "low". */
  riskLevel: "high" | "medium" | "low";
}

/**
 * Detects whether a record is a Prior Information Notice (PIN) or early
 * engagement signal based on title/summary keywords.
 */
function isPINSignal(record: FrameworkDrawdown): boolean {
  const haystack = `${record.title}`.toLowerCase();
  const pinKeywords = [
    "prior information notice",
    "pin",
    "early engagement",
    "market engagement",
    "pre-market",
    "soft market testing",
    "market sounding",
    "expression of interest",
    "request for information",
    "rfi",
    "industry engagement",
    "market consultation",
  ];
  return pinKeywords.some((kw) => haystack.includes(kw));
}

/**
 * Detects market engagement sessions from detail_fields.
 */
function hasMarketEngagement(record: FrameworkDrawdown): boolean {
  const df = record.detail_fields;
  if (!df) return false;
  const haystack = JSON.stringify(df).toLowerCase();
  const engagementKeywords = [
    "market engagement",
    "industry day",
    "supplier day",
    "briefing",
    "market sounding",
    "stakeholder workshop",
    "engagement session",
  ];
  return engagementKeywords.some((kw) => haystack.includes(kw));
}

/**
 * Gets framework runway analysis for all active frameworks.
 * Returns frameworks with unspent budget, expiry risk, and market engagement.
 */
export async function getFrameworkRunway(): Promise<FrameworkRunway[]> {
  const records = await fetchFrameworkRecords();
  const now = new Date().toISOString();

  const runwayResults: FrameworkRunway[] = [];

  for (const record of records) {
    const expiryDate = record.closing_date ?? null;
    const daysUntilExpiry = expiryDate
      ? daysBetween(now, expiryDate)
      : null;

    const isPIN = isPINSignal(record);
    const marketEngagement = hasMarketEngagement(record);

    // Estimate drawdown from detail_fields or use total value as baseline.
    const detailFields = record.detail_fields ?? {};
    const spentValue =
      (detailFields.spent_value as number) ??
      (detailFields.drawdown_value as number) ??
      (detailFields.committed_value as number) ??
      0;
    const totalValue = record.estimated_value ?? 0;
    const unspentBudget = totalValue - spentValue;

    // Calculate drawdown rate (spent per month) based on age of framework.
    const createdDate = record.created ?? now;
    const frameworkAgeDays = daysBetween(createdDate, now);
    const frameworkAgeMonths = Math.max(frameworkAgeDays / 30, 0.5); // min 0.5 months
    const drawdownRate = spentValue / frameworkAgeMonths;
    const drawdownPct = totalValue > 0 ? (spentValue / totalValue) * 100 : 0;

    // Determine risk level.
    let riskLevel: "high" | "medium" | "low" = "low";
    let runwayTag: string | null = null;

    if (daysUntilExpiry !== null && daysUntilExpiry <= 180 && daysUntilExpiry > 0) {
      if (unspentBudget > 0 && drawdownPct < 50) {
        riskLevel = "high";
        runwayTag = `Framework Runway: "${record.title}" (${record.buyer ?? "unknown buyer"}) expires in ${daysUntilExpiry} days with £${unspentBudget.toLocaleString()} unspent — buyer likely in shaping phase for re-tender.`;
      } else if (unspentBudget > 0) {
        riskLevel = "medium";
        runwayTag = `Framework Monitoring: "${record.title}" expires in ${daysUntilExpiry} days with £${unspentBudget.toLocaleString()} remaining.`;
      }
    }

    if (isPIN && !runwayTag) {
      riskLevel = "high";
      runwayTag = `PIN Early Intent: "${record.title}" — Prior Information Notice indicates upcoming tender. Buyer in shaping phase.`;
    }

    if (marketEngagement && !runwayTag) {
      riskLevel = "medium";
      runwayTag = `Market Engagement Detected: "${record.title}" — buyer holding industry sessions, specification likely being drafted.`;
    }

    runwayResults.push({
      canonicalId: record.canonical_id,
      title: record.title,
      buyer: record.buyer,
      buyerCanonicalId: record.buyer_canonical_id,
      sector: record.sector,
      region: record.region,
      estimatedValue: record.estimated_value,
      currency: record.currency,
      expiryDate,
      daysUntilExpiry,
      unspentBudget: unspentBudget > 0 ? unspentBudget : null,
      drawdownRate: drawdownRate > 0 ? drawdownRate : null,
      drawdownPct: drawdownPct > 0 ? drawdownPct : null,
      isPIN,
      marketEngagement,
      runwayTag,
      riskLevel,
    });
  }

  // Sort by risk level and days until expiry.
  runwayResults.sort((a, b) => {
    const riskOrder = { high: 3, medium: 2, low: 1 };
    const aRisk = riskOrder[a.riskLevel];
    const bRisk = riskOrder[b.riskLevel];
    if (aRisk !== bRisk) return bRisk - aRisk;
    if (a.daysUntilExpiry === null) return 1;
    if (b.daysUntilExpiry === null) return -1;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });

  info("framework_runway", {
    frameworksAnalyzed: runwayResults.length,
    highRisk: runwayResults.filter((r) => r.riskLevel === "high").length,
  });

  return runwayResults;
}

export { fetchFrameworkRecords, isPINSignal, hasMarketEngagement };
export type { FrameworkDrawdown, FrameworkRunway };
