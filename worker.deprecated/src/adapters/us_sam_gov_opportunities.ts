/**
 * US SAM.gov Contract Awards source adapter.
 *
 * Discovers federal contract award data from the US SAM.gov (System for Award
 * Management) using the USAspending.gov API for award forensics and sub-tier
 * contract analysis.
 *
 * Official API Documentation: https://api.usaspending.gov/api/v2/
 * USAspending API: https://api.usaspending.gov/api/v2/search/spending_by_award/
 * Covers prime awards, sub-awards, and subcontracting data.
 *
 * Configuration:
 *   US_SPENDING_API_URL - Base URL for the USAspending API
 *   US_SPENDING_API_KEY - API key (optional, higher rate limits with key)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const US_SPENDING_API_URL =
  process.env.US_SPENDING_API_URL ||
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

const US_SPENDING_API_KEY = process.env.US_SPENDING_API_KEY;

export class USSamGovOpportunitiesAdapter extends BaseSourceAdapter {
  constructor() {
    super("us_sam_gov_opportunities", true);
  }

  async discover(): Promise<SourceRecord[]> {
    try {
      const url = new URL(US_SPENDING_API_URL);

      const payload = {
        filters: {
          time_period: [
            {
              start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              end_date: new Date().toISOString().split("T")[0],
            },
          ],
          award_type_codes: ["A", "B", "C", "D"], // Contracts
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Award Amount",
          "Awarding Agency",
          "Awarding Sub Agency",
          "Funding Agency",
          "Funding Sub Agency",
          "Place of Performance State Code",
          "Place of Performance Country Code",
          "Description",
          "Action Date",
          "Period of Performance Start Date",
          "Period of Performance End Date",
        ],
        page: 1,
        limit: 100,
        sort: "Action Date",
        order: "desc",
      };

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (US_SPENDING_API_KEY) {
        headers["Authorization"] = `Bearer ${US_SPENDING_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        console.error(
          `[worker] USAspending API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const results = (data as Record<string, unknown>).results as unknown[];
      const records: SourceRecord[] = results.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const awardId = raw["Award ID"] ?? raw.id ?? "";
        return {
          sourceId: String(awardId),
          sourceName: "us_sam_gov_opportunities",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              `https://www.usaspending.gov/award/${awardId}`,
          ),
          rawPayload: raw,
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] USAspending adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new USSamGovOpportunitiesAdapter();