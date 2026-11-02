/**
 * US SAM.gov Opportunities source adapter.
 *
 * Discovers federal procurement opportunities from the US System for Award
 * Management (SAM.gov) Opportunities API.
 *
 * Official API Documentation: https://api.data.gov/docs/sam/
 * SAM.gov Opportunities API: https://api.sam.gov/prod/opportunities/v2/search
 * Requires SAM.gov API Key (free registration at https://api.data.gov/signup/)
 *
 * Configuration:
 *   US_SAM_GOV_API_URL - Base URL for the SAM.gov Opportunities API
 *   SAM_GOV_API_KEY - API key for SAM.gov (required for production use)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const US_SAM_GOV_API_URL =
  process.env.US_SAM_GOV_API_URL ||
  "https://api.sam.gov/prod/opportunities/v2/search";

const SAM_GOV_API_KEY = process.env.SAM_GOV_API_KEY;

export class USSamGovAdapter extends BaseSourceAdapter {
  readonly country = "US" as const;

  constructor() {
    super("us_sam_gov", true);
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
      const url = new URL(US_SAM_GOV_API_URL);
      url.searchParams.set("limit", "100");
      url.searchParams.set("isActive", "true");
      url.searchParams.set("postedFrom", params.publishedAfter.split("T")[0]);
      url.searchParams.set("postedTo", new Date().toISOString().split("T")[0]);

      if (SAM_GOV_API_KEY) {
        url.searchParams.set("api_key", SAM_GOV_API_KEY);
      } else {
        console.warn("[worker] SAM_GOV_API_KEY not set - using unauthenticated requests (rate limited)");
      }

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "SourceSignal/1.0",
        },
      });

      if (!resp.ok) {
        console.error(
          `[worker] US SAM.gov API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).opportunitiesData ||
          (data as Record<string, unknown>).opportunities ||
          (data as Record<string, unknown>).results ||
          []) as unknown[];

      const records: SourceRecord[] = rawArray.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const noticeId = raw.noticeId ?? raw.id ?? raw.solicitationNumber ?? "";
        const region = String(raw.region ?? "US").toUpperCase();
        return {
          sourceId: String(noticeId),
          sourceName: "us_sam_gov",
          country: "US",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              raw.uiLink ??
              `https://sam.gov/opp/${noticeId}/view`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] US SAM.gov adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new USSamGovAdapter();