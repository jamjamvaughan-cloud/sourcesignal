/**
 * US California eProcure (Cal eProcure) source adapter.
 *
 * Discovers procurement opportunities from the California Open Data Portal
 * (data.ca.gov) via the CKAN Datastore API.
 *
 * Official Portal: https://data.ca.gov/
 * Dataset: California eProcurement bid opportunities
 * Resource ID: 2081d0f5-5a50-4d40-9602-0e3f283d5a42
 *
 * Configuration:
 *   US_CALEPROCURE_API_URL - Override for the CKAN datastore search endpoint
 *   US_CALEPROCURE_API_KEY - Optional API key for authenticated access
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const US_CALEPROCURE_API_URL =
  process.env.US_CALEPROCURE_API_URL ||
  "https://data.ca.gov/api/3/action/datastore_search?resource_id=2081d0f5-5a50-4d40-9602-0e3f283d5a42";

const US_CALEPROCURE_API_KEY = process.env.US_CALEPROCURE_API_KEY;

export class USCalProcureAdapter extends BaseSourceAdapter {
  readonly country = "US" as const;

  constructor() {
    super("us_caleprocure", true);
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
      const baseUrl = new URL(US_CALEPROCURE_API_URL);
      baseUrl.searchParams.set("limit", "100");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (US_CALEPROCURE_API_KEY) {
        headers["Authorization"] = `Bearer ${US_CALEPROCURE_API_KEY}`;
      }

      const resp = await fetch(baseUrl.toString(), {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] CA eProcure (data.ca.gov) API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;
      const result = (data as Record<string, unknown>).result || {};
      const rawArray = ((result as Record<string, unknown>).records || []) as unknown[];

      const publishedAfterMs = new Date(params.publishedAfter).getTime();
      const records: SourceRecord[] = [];

      for (const item of rawArray) {
        const raw = item as Record<string, unknown>;
        const bidId =
          raw.bid_id ?? raw.id ?? raw.bid_number ?? raw.opportunity_id ?? "";
        const region = String(raw.region ?? "US").toUpperCase();

        // Client-side date filtering.
        const dateStr =
          String(raw.posted_date ?? raw.publish_date ?? raw.created_date ?? "");
        if (dateStr) {
          const recordDate = new Date(dateStr).getTime();
          if (recordDate < publishedAfterMs) {
            continue;
          }
        }

        records.push({
          sourceId: String(bidId),
          sourceName: "us_caleprocure",
          country: "US",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              raw.bid_link ??
              `https://caleprocure.ca.gov/bid/${bidId}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error(
        `[worker] CA eProcure adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new USCalProcureAdapter();
