/**
 * Scotland Scottish Water source adapter.
 *
 * Discovers procurement opportunities from Scottish Water's procurement portal.
 *
 * Official Portal: https://www.scottishwater.co.uk/your-business/procurement
 * Note: Scottish Water publishes procurement opportunities via Public Contracts Scotland.
 * This adapter uses the PCS OCDS feed filtered for Scottish Water as the buyer.
 *
 * Configuration:
 *   SCOTLAND_SCOTTISH_WATER_API_URL - Base URL for the PCS OCDS API
 *   SCOTLAND_SCOTTISH_WATER_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const SCOTLAND_SCOTTISH_WATER_API_URL =
  process.env.SCOTLAND_SCOTTISH_WATER_API_URL ||
  "https://www.publiccontractsscotland.gov.uk/ocds";

const SCOTLAND_SCOTTISH_WATER_API_KEY = process.env.SCOTLAND_SCOTTISH_WATER_API_KEY;

export class ScotlandScottishWaterAdapter extends BaseSourceAdapter {
  readonly country = "UK" as const;

  constructor() {
    super("scotland_scottish_water", true);
  }

  async discover(): Promise<SourceRecord[]> {
    return this.fetchDeltas({
      publishedAfter: new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  async fetchDeltas(params: { publishedAfter: string }): Promise<SourceRecord[]> {
    try {
      const url = new URL(SCOTLAND_SCOTTISH_WATER_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      // Filter for Scottish Water as buyer
      url.searchParams.set("buyer", "Scottish Water");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (SCOTLAND_SCOTTISH_WATER_API_KEY) {
        headers["Authorization"] = `Bearer ${SCOTLAND_SCOTTISH_WATER_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Scottish Water API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).releases ||
          (data as Record<string, unknown>).results ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const swRecords = rawArray.filter((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const buyer = String(raw.buyer ?? raw.buyerName ?? raw.organisation ?? "").toLowerCase();
        return buyer.includes("scottish water");
      });

      const records: SourceRecord[] = swRecords.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const ocid = raw.ocid ?? raw.id ?? tender?.id ?? "";
        const region = String(raw.region ?? tender?.region ?? "SCT").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "scotland_scottish_water",
          country: "UK",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://www.publiccontractsscotland.gov.uk/contract/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] Scottish Water adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new ScotlandScottishWaterAdapter();