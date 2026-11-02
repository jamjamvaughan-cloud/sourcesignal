/**
 * UK Contracts Finder source adapter.
 *
 * Discovers procurement opportunities from the UK government's Contracts
 * Finder service (https://www.contractsfinder.service.gov.uk/).
 *
 * This adapter fetches recently published contract opportunities from the
 * Contracts Finder API and normalises them into SourceSignal's common schema
 * for downstream ingestion, extraction, and deduplication.
 *
 * Official API Reference: https://www.contractsfinder.service.gov.uk/Public/Api
 * OCDS Feed: https://www.contractsfinder.service.gov.uk/Public/Api/OCDS
 *
 * To use this adapter, configure the UK_CONTRACTS_FINDER_API_URL environment
 * variable with the base URL of the Contracts Finder API endpoint.
 * Optional: UK_CONTRACTS_FINDER_API_KEY for authenticated access.
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const UKCF_API_URL =
  process.env.UK_CONTRACTS_FINDER_API_URL ||
  "https://www.contractsfinder.service.gov.uk/Public/Api/OCDS";

const UKCF_API_KEY = process.env.UK_CONTRACTS_FINDER_API_KEY;

export class UkContractsFinderAdapter extends BaseSourceAdapter {
  readonly country = "UK" as const;

  constructor() {
    super("uk_contracts_finder", true);
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
      const url = new URL(UKCF_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (UKCF_API_KEY) {
        headers["Authorization"] = `Bearer ${UKCF_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] UK Contracts Finder API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).releases ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const records: SourceRecord[] = rawArray.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const ocid = raw.ocid ?? raw.id ?? tender?.id ?? "";
        const region = String(raw.region ?? tender?.region ?? "ENG").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "uk_contracts_finder",
          country: "UK",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://www.contractsfinder.service.gov.uk/Notice/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] UK Contracts Finder adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new UkContractsFinderAdapter();