/**
 * Australia State Procurement source adapter.
 *
 * Discusses state-level procurement from the NSW Buy (buy.nsw.gov.au) API.
 *
 * Official API: https://api.buy.nsw.gov.au/v1/opportunities/search
 *
 * Configuration:
 *   AU_STATE_PROCUREMENT_API_URL - Override for the NSW Buy API endpoint
 *   AU_STATE_PROCUREMENT_API_KEY - Optional API key for authenticated access
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const AU_STATE_PROCUREMENT_API_URL =
  process.env.AU_STATE_PROCUREMENT_API_URL ||
  "https://api.buy.nsw.gov.au/v1/opportunities/search";

const AU_STATE_PROCUREMENT_API_KEY = process.env.AU_STATE_PROCUREMENT_API_KEY;

export class AUStateProcurementAdapter extends BaseSourceAdapter {
  readonly country = "AU" as const;

  constructor() {
    super("au_state_procurement", true);
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
      const url = new URL(AU_STATE_PROCUREMENT_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      url.searchParams.set("limit", "100");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (AU_STATE_PROCUREMENT_API_KEY) {
        headers["Authorization"] = `Bearer ${AU_STATE_PROCUREMENT_API_KEY}`;
      }

      const resp = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] AU State Procurement (buy.nsw.gov.au) API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;
      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).results ||
          (data as Record<string, unknown>).opportunities ||
          (data as Record<string, unknown>).items ||
          []) as unknown[];

      const publishedAfterMs = new Date(params.publishedAfter).getTime();
      const records: SourceRecord[] = [];

      for (const item of rawArray) {
        const raw = item as Record<string, unknown>;
        const id = String(raw.id ?? raw.opportunity_id ?? raw.tender_id ?? "");

        // Client-side date filtering.
        const dateStr =
          String(raw.published_date ?? raw.publish_date ?? raw.created_date ?? "");
        if (dateStr) {
          const recordDate = new Date(dateStr).getTime();
          if (recordDate < publishedAfterMs) {
            continue;
          }
        }

        const region = String(raw.region ?? raw.state ?? "AU").toUpperCase();

        records.push({
          sourceId: id,
          sourceName: "au_state_procurement",
          country: "AU",
          sourceUrl: String(
            raw.source_url ?? raw.url ?? `https://buy.nsw.gov.au/opportunity/${id}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error("[worker] AU State Procurement adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new AUStateProcurementAdapter();
