/**
 * EU EDA (European Defence Agency) source adapter.
 *
 * Discusses defence procurement from the TED v3 API, filtered to notices
 * where the buyer is the European Defence Agency.
 *
 * Official API: https://api.ted.europa.eu/v3/notices/search
 *
 * Configuration:
 *   EU_EDA_API_URL - Override for the TED v3 search endpoint
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const EU_EDA_API_URL =
  process.env.EU_EDA_API_URL || "https://api.ted.europa.eu/v3/notices/search";

export class EUEDAAdapter extends BaseSourceAdapter {
  readonly country = "EU" as const;

  constructor() {
    super("eu_eda", true);
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

      // TED v3 search payload — notices where the buyer is the European Defence Agency.
      const body = {
        query: {
          condition: [
            {
              field: "BT-05-published-date",
              operator: "greater-than",
              value: startDate,
            },
            {
              field: "BT-71-procurement-buyer-name",
              operator: "equals",
              value: "European Defence Agency",
            },
          ],
        },
        scope: [],
        languages: [],
      };

      const resp = await fetch(EU_EDA_API_URL, {
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
          `[worker] EU EDA (TED v3) API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;
      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).notices ??
          (data as Record<string, unknown>).results ??
          (data as Record<string, unknown>).tenders ??
          []) as unknown[];

      const publishedAfterMs = new Date(params.publishedAfter).getTime();
      const records: SourceRecord[] = [];

      for (const item of rawArray) {
        const raw = item as Record<string, unknown>;
        const id =
          String(raw.id ?? raw.notice_id ?? raw.noticeId ?? raw.ted_id ?? "");

        const dateStr =
          String(raw.published_date ?? raw.date ?? raw.publication_date ?? "");
        if (dateStr) {
          const recordDate = new Date(dateStr).getTime();
          if (recordDate < publishedAfterMs) {
            continue;
          }
        }

        const region = String(raw.region ?? "EU").toUpperCase();

        records.push({
          sourceId: id,
          sourceName: "eu_eda",
          country: "EU",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              `https://ted.europa.eu/tender/${id}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error("[worker] EU EDA adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new EUEDAAdapter();
