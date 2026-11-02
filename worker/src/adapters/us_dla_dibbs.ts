/**
 * US DLA DIBBS (Defense Logistics Agency) source adapter.
 *
 * Discovers defence procurement opportunities from the USASpending.gov API,
 * filtered to the Defense Logistics Agency (DLA) awarding agency.
 *
 * Official API: https://api.usaspending.gov/
 * Endpoint: POST /api/v2/search/spending_by_award/
 *
 * Configuration:
 *   DLA_DIBBS_API_URL - Override for the USAspending search endpoint
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const DLA_DIBBS_API_URL =
  process.env.DLA_DIBBS_API_URL ||
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

export class DLADIBBSAdapter extends BaseSourceAdapter {
  readonly country = "US" as const;

  constructor() {
    super("us_dla_dibbs", true);
  }

  async discover(): Promise<SourceRecord[]> {
    return this.fetchDeltas({
      publishedAfter: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  async fetchDeltas(params: { publishedAfter: string }): Promise<SourceRecord[]> {
    try {
      const startDate = params.publishedAfter.split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      const body = {
        filters: {
          time_period: [
            {
              start_date: startDate,
              end_date: endDate,
            },
          ],
          agencies: [
            {
              type: "awarding",
              tier: "agency",
              name: "Defense Logistics Agency",
            },
          ],
        },
        limit: 100,
        sort: "Award Amount",
        order: "desc",
      };

      const resp = await fetch(DLA_DIBBS_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "SourceSignal/1.0",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error(
          `[worker] DLA DIBBS (USAspending) API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;
      const results = (data as Record<string, unknown>).results || [];
      const records: SourceRecord[] = [];

      for (const item of results as unknown[]) {
        const raw = item as Record<string, unknown>;
        records.push({
          sourceId: String(raw.award_id ?? raw.id ?? ""),
          sourceName: "us_dla_dibbs",
          country: "US",
          sourceUrl: String(
            raw.award_url ?? `https://www.usaspending.gov/award/${raw.award_id ?? ""}`,
          ),
          rawPayload: { ...raw, region: "US" },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error("[worker] DLA DIBBS adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new DLADIBBSAdapter();
