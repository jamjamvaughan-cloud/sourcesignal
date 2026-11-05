/**
 * Signal Enrichment Layer.
 *
 * Enriches raw ScoredSignals with predictive intelligence tags from all
 * intelligence layers:
 *   1. Pre-Tender Renewal Risk (expiry within 90–120 days)
 *   2. Competitive Density / Share of Voice (incumbent lock-in)
 *   3. Buyer Spending Velocity / Budget Flush indicators
 *   4. Cross-Border Sector Momentum (country x sector growth)
 *   5. Framework Runway Tracking (PINs, framework drawdown, unspent budget)
 *   6. Incumbent Churn Detection (early termination, market testing, winner churn)
 *   7. Regulatory Spike Radar (regulatory deadline correlation, spending waves)
 *   8. Cross-Border Matchmaker (RFP structure matching, equivalent buyers)
 *
 * These enrichment calls are async and may return null when PocketBase is
 * unavailable — enrichment is best-effort and never blocks signal delivery.
 */

import { computeSignalAndNormalize, type ScoredSignal } from "@/lib/signals-engine";
import type { CountryCode, SourceRecord } from "@/types";
import {
  getPreTenderRisk,
  type PreTenderRisk,
  getBuyerCompetitiveProfile,
  type BuyerCompetitiveProfile,
  getBuyerSpendingVelocity,
  type SpendingVelocity,
  getSectorMomentum,
  type SectorMomentum,
} from "@/lib/historical-intelligence";
import {
  getFrameworkRunway,
  type FrameworkRunway,
} from "@/lib/framework-runway";
import {
  getAllBuyerChurnProfiles,
  type BuyerChurnProfile,
} from "@/lib/incumbent-churn";
import {
  getRegulatorySpikes,
  type RegulatorySpike,
} from "@/lib/regulatory-spike";
import {
  getCrossBorderMatches,
  type CrossBorderMatch,
} from "@/lib/cross-border-matchmaker";

export interface EnrichedSignal extends ScoredSignal {
  renewalRisk: PreTenderRisk | null;
  competitiveDensity: BuyerCompetitiveProfile | null;
  spendingVelocity: SpendingVelocity | null;
  sectorMomentum: SectorMomentum | null;
  frameworkRunway: FrameworkRunway | null;
  incumbentChurn: BuyerChurnProfile | null;
  regulatorySpike: RegulatorySpike | null;
  crossBorderMatch: CrossBorderMatch | null;
}

export async function enrichSignal(
  record: SourceRecord,
): Promise<EnrichedSignal> {
  const countryCode = (record.country ?? "UK") as CountryCode;
  const baseSignal = await computeSignalAndNormalize(record, countryCode);

  const [
    renewalRisk,
    competitiveDensity,
    spendingVelocity,
    sectorMomentum,
    frameworkRunway,
    incumbentChurn,
    regulatorySpike,
    crossBorderMatch,
  ] = await Promise.allSettled([
    getPreTenderRisk(
      baseSignal.canonicalId,
      baseSignal.closingDate ?? undefined,
    ),
    (baseSignal.buyer || baseSignal.buyerCanonicalId)
      ? getBuyerCompetitiveProfile(baseSignal.buyer ?? "")
      : Promise.resolve<BuyerCompetitiveProfile | null>(null),
    (baseSignal.buyer || baseSignal.buyerCanonicalId)
      ? getBuyerSpendingVelocity(
          baseSignal.buyer ?? "",
        )
      : Promise.resolve<SpendingVelocity | null>(null),
    getSectorMomentum(baseSignal.sector, countryCode),
    getFrameworkRunway().then((results) =>
      results.find((r) => r.canonicalId === baseSignal.canonicalId) ?? null,
    ),
    (baseSignal.buyer || baseSignal.buyerCanonicalId)
      ? getAllBuyerChurnProfiles().then((profiles) =>
          profiles.find(
            (p) =>
              p.buyerCanonicalId === baseSignal.buyerCanonicalId ||
              p.buyer === baseSignal.buyer,
          ) ?? null,
        )
      : Promise.resolve<BuyerChurnProfile | null>(null),
    getRegulatorySpikes().then((spikes) =>
      spikes.find((s) => s.sector === baseSignal.sector) ?? null,
    ),
    getCrossBorderMatches().then((matches) =>
      matches.find((m) => m.sourceOpportunityId === baseSignal.canonicalId) ?? null,
    ),
  ]);

  return {
    ...baseSignal,
    renewalRisk:
      renewalRisk.status === "fulfilled" ? renewalRisk.value : null,
    competitiveDensity:
      competitiveDensity.status === "fulfilled"
        ? competitiveDensity.value
        : null,
    spendingVelocity:
      spendingVelocity.status === "fulfilled" ? spendingVelocity.value : null,
    sectorMomentum:
      sectorMomentum.status === "fulfilled" ? sectorMomentum.value : null,
    frameworkRunway:
      frameworkRunway.status === "fulfilled" ? frameworkRunway.value : null,
    incumbentChurn:
      incumbentChurn.status === "fulfilled" ? incumbentChurn.value : null,
    regulatorySpike:
      regulatorySpike.status === "fulfilled" ? regulatorySpike.value : null,
    crossBorderMatch:
      crossBorderMatch.status === "fulfilled" ? crossBorderMatch.value : null,
  };
}

/**
 * Batch enriches an array of source records. Returns signals with
 * intelligence tags where available.
 */
export async function enrichSignalsBatch(
  records: SourceRecord[],
): Promise<EnrichedSignal[]> {
  return Promise.all(records.map((record) => enrichSignal(record)));
}
