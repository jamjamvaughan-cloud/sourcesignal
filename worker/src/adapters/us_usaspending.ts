/**
 * US USAspending.gov source adapter.
 *
 * Discovers federal procurement awards from USAspending.gov API.
 * Official API: https://api.usaspending.gov/
 */
import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const USA_SPENDING_API_URL =
  process.env.USA_SPENDING_API_URL ||
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

export class USASpendingAdapter extends BaseSourceAdapter {
  readonly country = "US" as const;

  constructor() {
    super("us_usaspending", true);
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
      const resp = await fetch(USA_SPENDING_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "SourceSignal/1.0",
        },
        body: JSON.stringify({
          filters: {
            time_period: [{
              start_date: params.publishedAfter.split("T")[0],
              end_date: new Date().toISOString().split("T")[0],
            }],
            award_type_codes: ["A", "B", "C", "D"],
          },
          limit: 100,
          sort: "Award Amount",
          order: "desc",
        }),
      });

      if (!resp.ok) return [];

      const data = (await resp.json()) as unknown;
      const results = (data as Record<string, unknown>).results || [];

      const records: SourceRecord[] = (results as unknown[]).map((item) => {
        const raw = item as Record<string, unknown>;
        return {
          sourceId: String(raw.award_id ?? raw.id ?? ""),
          sourceName: "us_usaspending",
          country: "US",
          sourceUrl: String(
            raw.award_url ?? `https://www.usaspending.gov/award/${raw.award_id ?? ""}`,
          ),
          rawPayload: { ...raw, region: "US" },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error("[worker] USAspending adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new USASpendingAdapter();
