/**
 * Canada BC Bid source adapter.
 *
 * Discovers provincial procurement opportunities from BC Bid (BC Bid Portal / MERX).
 * BC Bid is the official electronic tendering service for British Columbia.
 *
 * Official Portal: https://www.bcbid.ca/
 * BC Bid RSS/API: https://www.bcbid.ca/rss/
 * MERX API: https://api.merx.com/
 *
 * Configuration:
 *   CANADA_BC_BID_API_URL - Base URL for the BC Bid API
 *   CANADA_BC_BID_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const CANADA_BC_BID_API_URL =
  process.env.CANADA_BC_BID_API_URL ||
  "https://www.bcbid.ca/rss/";

const CANADA_BC_BID_API_KEY = process.env.CANADA_BC_BID_API_KEY;

export class CanadaBCBidAdapter extends BaseSourceAdapter {
  constructor() {
    super("canada_bc_bid", true);
  }

  async discover(): Promise<SourceRecord[]> {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (CANADA_BC_BID_API_KEY) {
        headers["Authorization"] = `Bearer ${CANADA_BC_BID_API_KEY}`;
      }

      const resp = await fetch(CANADA_BC_BID_API_URL, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Canada BC Bid API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).items ||
          (data as Record<string, unknown>).results ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const records: SourceRecord[] = rawArray.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const bidId = raw.bidId ?? raw.id ?? raw.tenderId ?? "";
        return {
          sourceId: String(bidId),
          sourceName: "canada_bc_bid",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              raw.bidUrl ??
              `https://www.bcbid.ca/bid/${bidId}`,
          ),
          rawPayload: raw,
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] Canada BC Bid adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new CanadaBCBidAdapter();