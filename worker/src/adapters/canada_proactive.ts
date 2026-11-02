/**
 * Canada Proactive Disclosure source adapter.
 *
 * Discovers contract award disclosures from the Government of Canada's
 * Proactive Disclosure of Contracts (over $10,000) dataset.
 *
 * Official API Documentation: https://open.canada.ca/data/en/dataset/
 * Proactive Disclosure API: https://open.canada.ca/data/api/package/result/search?query=proactive+disclosure
 * Open Government Portal API: https://open.canada.ca/data/en/api
 *
 * Configuration:
 *   CANADA_PROACTIVE_API_URL - Base URL for the Proactive Disclosure API
 *   CANADA_PROACTIVE_API_KEY - API key (optional, higher rate limits)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const CANADA_PROACTIVE_API_URL =
  process.env.CANADA_PROACTIVE_API_URL ||
  "https://open.canada.ca/data/api/record/package_search";

const CANADA_PROACTIVE_API_KEY = process.env.CANADA_PROACTIVE_API_KEY;

export class CanadaProactiveAdapter extends BaseSourceAdapter {
  constructor() {
    super("canada_proactive", true);
  }

  async discover(): Promise<SourceRecord[]> {
    try {
      const url = new URL(CANADA_PROACTIVE_API_URL);
      url.searchParams.set("q", "proactive disclosure contract award");
      url.searchParams.set("rows", "100");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (CANADA_PROACTIVE_API_KEY) {
        headers["Authorization"] = `Bearer ${CANADA_PROACTIVE_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Canada Proactive Disclosure API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const results = (data as Record<string, unknown>).result as Record<string, unknown>;
      const resultsArray = (results.results as unknown[]) ?? [];
      const records: SourceRecord[] = resultsArray.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const contractId = raw.id ?? raw.contract_id ?? raw.award_id ?? "";
        return {
          sourceId: String(contractId),
          sourceName: "canada_proactive",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              raw.resource_url ??
              `https://open.canada.ca/data/en/dataset/${contractId}`,
          ),
          rawPayload: raw,
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] Canada Proactive Disclosure adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new CanadaProactiveAdapter();