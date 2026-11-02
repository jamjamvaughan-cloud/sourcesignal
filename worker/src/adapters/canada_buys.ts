/**
 * CanadaBuys source adapter.
 *
 * Discovers federal procurement opportunities from the Government of Canada's
 * CanadaBuys platform (formerly buyandsell.gc.ca).
 *
 * Official API Documentation: https://buyandsell.gc.ca/data
 * CanadaBuys OCDS Feed: https://buyandsell.gc.ca/api/publications/v1/ocds
 * Open Data Portal: https://open.canada.ca/data/en/dataset/
 *
 * Configuration:
 *   CANADA_BUYS_API_URL - Base URL for the CanadaBuys OCDS API
 *   CANADA_BUYS_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const CANADA_BUYS_API_URL =
  process.env.CANADA_BUYS_API_URL ||
  "https://buyandsell.gc.ca/api/publications/v1/ocds";

const CANADA_BUYS_API_KEY = process.env.CANADA_BUYS_API_KEY;

export class CanadaBuysAdapter extends BaseSourceAdapter {
  readonly country = "CA" as const;

  constructor() {
    super("canada_buys", true);
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
      const url = new URL(CANADA_BUYS_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      url.searchParams.set("limit", "100");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (CANADA_BUYS_API_KEY) {
        headers["Authorization"] = `Bearer ${CANADA_BUYS_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] CanadaBuys API returned ${resp.status}`,
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

      const records: SourceRecord[] = rawArray.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const ocid = raw.ocid ?? raw.id ?? tender?.id ?? "";
        const region = String(raw.region ?? tender?.region ?? "CA").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "canada_buys",
          country: "CA",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://buyandsell.gc.ca/notice/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] CanadaBuys adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new CanadaBuysAdapter();