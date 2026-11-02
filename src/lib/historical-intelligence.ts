/**
 * Historical Intelligence Layer.
 *
 * Queries historical opportunity records to attach predictive intelligence
 * tags to live signals:
 *   1. Pre-Tender Renewal Risk (90–120 days before contract expiry)
 *   2. Competitive Density / Share of Voice (incumbent lock-in vs open market)
 *   3. Buyer Spending Velocity / Budget Flush indicators
 *   4. Cross-Border Sector Momentum (country x sector growth trends)
 *
 * All functions are server-side only and use PostgreSQL queries.
 */

import { query } from "@/lib/db";
import type { CountryCode } from "@/types";

/** Days window considered "expiring soon" for pre-tender risk. */
export const PRE_TENDER_WINDOW_DAYS = 120;

/** Days window considered "historical" for competitive density analysis. */
export const COMPETITIVE_LOOKBACK_DAYS = 3 * 365; // 3 years

/** Days window for spending velocity / budget flush detection. */
export const SPENDING_VELOCITY_WINDOW_DAYS = 7;

/** Lookback for baseline spending comparison. */
export const SPENDING_BASELINE_DAYS = 30;

/** Threshold multiplier for budget flush detection (4x normal volume). */
export const BUDGET_FLUSH_MULTIPLIER = 4;

/** Length of the "current" vs "baseline" momentum comparison windows. */
export const MOMENTUM_WINDOW_DAYS = 30;

/**
 * Historical award record from PostgreSQL.
 */
interface HistoricalAward {
  id: string;
  canonical_id: string;
  title: string;
  buyer: string | null;
  buyer_canonical_id: string | null;
  sector: string | null;
  region: string | null;
  closing_date: string | null;
  estimated_value: string | number | null;
  currency: string | null;
  winner: string | null;
  signal_tier: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Aggregated buyer award history for competitive density.
 */
export interface BuyerCompetitiveProfile {
  buyer: string;
  totalAwards: number;
  uniqueSuppliers: number;
  topSupplier: string | null;
  topSupplierWins: number;
  incumbentLockIn: boolean; // true if one supplier won >60% of awards
  competitiveDensityTag: string;
}

/**
 * Pre-tender renewal risk assessment.
 */
export interface PreTenderRisk {
  canonicalId: string;
  title: string;
  buyer: string | null;
  estimatedValue: number | null;
  currency: string | null;
  closingDate: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  renewalRiskTag: string | null;
  historicalRetenderPattern: string | null;
}

/**
 * Buyer spending velocity assessment.
 */
export interface SpendingVelocity {
  buyer: string;
  transactionCount: number;
  totalValue: number;
  averageWeeklyValue: number;
  isBudgetFlush: boolean;
  flushTag: string | null;
}

/**
 * Cross-border sector momentum score.
 */
export interface SectorMomentum {
  sector: string;
  country: CountryCode;
  currentPeriodCount: number;
  baselinePeriodCount: number;
  growthPercent: number;
  momentumTag: string | null;
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
 * Module 2: Competitive Density / Share of Voice.
 *
 * Correlates a buyer's historical awards to determine incumbent lock-in.
 * Returns a profile showing which suppliers dominate a buyer's contracts.
 */
export async function getBuyerCompetitiveProfile(
  buyer: string,
): Promise<BuyerCompetitiveProfile | null> {
  const result = await query(
    `SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector, region,
            closing_date, estimated_value, currency, winner, signal_tier,
            created_at, updated_at
     FROM opportunities
     WHERE buyer_canonical_id IS NOT NULL
       AND winner IS NOT NULL
       AND winner != ''
       AND LOWER(buyer) = LOWER($1)
       AND created_at >= NOW() - ($2 || ' days')::interval
     ORDER BY created_at DESC`,
    [buyer, COMPETITIVE_LOOKBACK_DAYS],
  );
  const awards = result.rows as HistoricalAward[];
  const buyerAwards = awards.filter(
    (award) => award.buyer && award.buyer.toLowerCase() === buyer.toLowerCase(),
  );

  if (buyerAwards.length === 0) {
    return {
      buyer,
      totalAwards: 0,
      uniqueSuppliers: 0,
      topSupplier: null,
      topSupplierWins: 0,
      incumbentLockIn: false,
      competitiveDensityTag:
        "Open Market Signal: No historical award data for this buyer.",
    };
  }

  const supplierWins = new Map<string, number>();
  for (const award of buyerAwards) {
    if (award.winner) {
      supplierWins.set(
        award.winner,
        (supplierWins.get(award.winner) ?? 0) + 1,
      );
    }
  }

  const sortedSuppliers = Array.from(supplierWins.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const topSupplier = sortedSuppliers[0];
  const topSupplierWins = topSupplier?.[1] ?? 0;
  const uniqueSuppliers = supplierWins.size;
  const incumbentLockIn =
    buyerAwards.length > 0 && topSupplierWins / buyerAwards.length > 0.6;

  let competitiveDensityTag: string;
  if (incumbentLockIn) {
    competitiveDensityTag = `High incumbent lock-in: Supplier "${topSupplier?.[0]}" has won ${topSupplierWins} out of ${buyerAwards.length} contracts with this buyer over 3 years.`;
  } else if (uniqueSuppliers > buyerAwards.length * 0.8) {
    competitiveDensityTag = `Open Market Signal: Buyer changes suppliers on ${Math.round(
      (uniqueSuppliers / buyerAwards.length) * 100,
    )}% of renewals.`;
  } else {
    competitiveDensityTag = `Mixed Market: ${uniqueSuppliers} suppliers across ${buyerAwards.length} awards; no dominant incumbent.`;
  }

  return {
    buyer,
    totalAwards: buyerAwards.length,
    uniqueSuppliers,
    topSupplier: topSupplier?.[0] ?? null,
    topSupplierWins,
    incumbentLockIn,
    competitiveDensityTag,
  };
}

/**
 * Module 1: Pre-Tender Renewal Risk.
 *
 * Identifies contracts expiring within 90–120 days and attaches
 * historical re-tender pattern warnings.
 */
export async function getPreTenderRisk(
  canonicalId: string,
  closingDate?: string | null,
): Promise<PreTenderRisk | null> {
  const result = await query(
    `SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector, region,
            closing_date, estimated_value, currency, winner, signal_tier,
            created_at, updated_at
     FROM opportunities WHERE canonical_id = $1`,
    [canonicalId],
  );

  const record = result.rows[0] as HistoricalAward | undefined;
  if (!record) return null;

  const title = record.title;
  const buyer = record.buyer;
  const estimatedValue =
    record.estimated_value != null ? Number(record.estimated_value) : null;
  const currency = record.currency;
  const closeDate = record.closing_date ?? closingDate ?? null;

  let daysUntilExpiry: number | null = null;
  let isExpiringSoon = false;
  let renewalRiskTag: string | null = null;
  let historicalRetenderPattern: string | null = null;

  if (closeDate) {
    daysUntilExpiry = daysBetween(new Date().toISOString(), closeDate);
    isExpiringSoon =
      daysUntilExpiry > 0 && daysUntilExpiry <= PRE_TENDER_WINDOW_DAYS;

    if (isExpiringSoon) {
      renewalRiskTag = `Upcoming Renewal Risk: "${title}" (${buyer ?? "unknown buyer"}) expires in ${daysUntilExpiry} days.`;

      // Historical awards for the same buyer, to measure how often they
      // re-tender shortly before expiry.
      let buyerAwards: HistoricalAward[] = [];
      if (record.buyer_canonical_id) {
        const historical = await query(
          `SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector,
                  region, closing_date, estimated_value, currency, winner,
                  signal_tier, created_at, updated_at
             FROM opportunities
            WHERE buyer_canonical_id = $1
              AND id <> $2
              AND created_at >= NOW() - ($3 || ' days')::interval
            ORDER BY created_at DESC`,
          [
            record.buyer_canonical_id,
            record.id,
            COMPETITIVE_LOOKBACK_DAYS,
          ],
        );
        buyerAwards = historical.rows as HistoricalAward[];
      } else if (buyer) {
        const historical = await query(
          `SELECT id, canonical_id, title, buyer, buyer_canonical_id, sector,
                  region, closing_date, estimated_value, currency, winner,
                  signal_tier, created_at, updated_at
             FROM opportunities
            WHERE LOWER(buyer) = LOWER($1)
              AND id <> $2
              AND created_at >= NOW() - ($3 || ' days')::interval
            ORDER BY created_at DESC`,
          [buyer, record.id, COMPETITIVE_LOOKBACK_DAYS],
        );
        buyerAwards = historical.rows as HistoricalAward[];
      }

      if (buyerAwards.length > 0) {
        const retenderWithin45 = buyerAwards.filter((award) => {
          if (!award.closing_date || !award.created_at) return false;
          return daysBetween(award.created_at, award.closing_date) <= 45;
        }).length;

        const retenderPct = Math.round(
          (retenderWithin45 / buyerAwards.length) * 100,
        );
        historicalRetenderPattern = `Historical data shows re-tender drops ${retenderPct}% of the time within 45 days prior to expiry.`;
      } else {
        historicalRetenderPattern =
          "No historical re-tender data available for this buyer.";
      }
    }
  }

  return {
    canonicalId: record.canonical_id,
    title,
    buyer,
    estimatedValue,
    currency,
    closingDate: closeDate,
    daysUntilExpiry,
    isExpiringSoon,
    renewalRiskTag,
    historicalRetenderPattern,
  };
}

/**
 * Module 3: Buyer Spending Velocity / Budget Flush.
 *
 * Detects when a buyer accelerates posting frequency beyond baseline,
 * indicating unspent budget allocation (e.g., fiscal year-end flush).
 */
export async function getBuyerSpendingVelocity(
  buyer: string,
): Promise<SpendingVelocity | null> {
  const now = Date.now();
  const windowStart = new Date(
    now - SPENDING_VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const baselineStart = new Date(
    now - SPENDING_BASELINE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const currentRecords = await query(
    `SELECT id, buyer_canonical_id, buyer, sector, region, closing_date,
            estimated_value, currency, created_at
     FROM opportunities
     WHERE buyer_canonical_id = $1 AND created_at >= $2`,
    [buyer, windowStart],
  );

  const baselineRecords = await query(
    `SELECT id, buyer_canonical_id, buyer, sector, region, closing_date,
            estimated_value, currency, created_at
     FROM opportunities
     WHERE buyer_canonical_id = $1
       AND created_at >= $2
       AND created_at < $3`,
    [buyer, baselineStart, windowStart],
  );

  const currentRecordsArray = currentRecords.rows as HistoricalAward[];
  const baselineRecordsArray = baselineRecords.rows as HistoricalAward[];

  const currentCount = currentRecordsArray.length;
  const currentTotalValue = currentRecordsArray.reduce(
    (sum, item) => sum + (Number(item.estimated_value) || 0),
    0,
  );
  const baselineCount = baselineRecordsArray.length;
  const baselineTotalValue = baselineRecordsArray.reduce(
    (sum, item) => sum + (Number(item.estimated_value) || 0),
    0,
  );

  const averageWeeklyValue =
    baselineCount > 0
      ? baselineTotalValue / (SPENDING_BASELINE_DAYS / 7)
      : 0;
  const currentWeeklyValue =
    currentTotalValue / (SPENDING_VELOCITY_WINDOW_DAYS / 7);

  const isBudgetFlush =
    baselineCount > 0 &&
    currentWeeklyValue > averageWeeklyValue * BUDGET_FLUSH_MULTIPLIER;

  let flushTag: string | null = null;
  if (isBudgetFlush) {
    flushTag = `Budget Flush Detected: "${buyer}" has released ${Math.round(
      currentWeeklyValue / averageWeeklyValue,
    )}x its normal weekly volume in the last ${SPENDING_VELOCITY_WINDOW_DAYS} days.`;
  } else if (currentCount > 0) {
    flushTag = `Normal spending: ${currentCount} opportunities in the last ${SPENDING_VELOCITY_WINDOW_DAYS} days.`;
  } else {
    flushTag = `No recent procurement activity for "${buyer}".`;
  }

  return {
    buyer,
    transactionCount: currentCount,
    totalValue: currentTotalValue,
    averageWeeklyValue,
    isBudgetFlush,
    flushTag,
  };
}

/**
 * Module 4: Cross-Border Sector Momentum.
 *
 * Compares the last 30 days of signal volume against the preceding 30 days
 * for a country x sector pair to detect geographic demand trends.
 */
export async function getSectorMomentum(
  sector: string,
  country: CountryCode,
): Promise<SectorMomentum | null> {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (
         WHERE created_at >= NOW() - ($3 || ' days')::interval
       ) AS current_count,
       COUNT(*) FILTER (
         WHERE created_at >= NOW() - ($4 || ' days')::interval
           AND created_at < NOW() - ($3 || ' days')::interval
       ) AS baseline_count
     FROM opportunities
     WHERE sector = $1 AND country = $2`,
    [
      sector,
      country,
      MOMENTUM_WINDOW_DAYS,
      MOMENTUM_WINDOW_DAYS * 2,
    ],
  );

  const row = result.rows[0] as
    | { current_count: string; baseline_count: string }
    | undefined;
  const currentCount = Number(row?.current_count ?? 0);
  const baselineCount = Number(row?.baseline_count ?? 0);

  let growthPercent = 0;
  if (baselineCount === 0) {
    growthPercent = currentCount > 0 ? 100 : 0;
  } else {
    growthPercent = Math.round(
      ((currentCount - baselineCount) / baselineCount) * 100,
    );
  }

  let momentumTag: string | null = null;
  if (growthPercent >= 100) {
    momentumTag = `${sector} signals in ${country} grew ${growthPercent}% month-over-month compared to baseline.`;
  } else if (growthPercent >= 20) {
    momentumTag = `${sector} signals in ${country} show moderate growth (+${growthPercent}%).`;
  } else if (growthPercent <= -20) {
    momentumTag = `${sector} signals in ${country} declined ${Math.abs(growthPercent)}% month-over-month.`;
  } else {
    momentumTag = `${sector} signals in ${country} are stable (${growthPercent}% change).`;
  }

  return {
    sector,
    country,
    currentPeriodCount: currentCount,
    baselinePeriodCount: baselineCount,
    growthPercent,
    momentumTag,
  };
}
