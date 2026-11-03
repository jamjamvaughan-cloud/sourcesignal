/**
 * UK Find a Tender source adapter.
 *
 * Discovers procurement opportunities from the UK Find a Tender service
 * (https://www.find-tender.service.gov.uk/) - the UK's e-notification service
 * for high-value contracts (above £139,688 threshold).
 *
 * Official API Reference: https://www.find-tender.service.gov.uk/api
 * OCDS Feed: https://www.find-tender.service.gov.uk/api/oCDS
 *
 * Configuration:
 *   UK_FIND_A_TENDER_API_URL - Base URL for the Find a Tender API
 *   UK_FIND_A_TENDER_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const UK_FIND_A_TENDER_API_URL =
  process.env.UK_FIND_A_TENDER_API_URL ||
  "https://www.find-tender.service.gov.uk/api/oCDS";

const UK_FIND_A_TENDER_API_KEY = process.env.UK_FIND_A_TENDER_API_KEY;

export class UkFindATenderAdapter extends BaseSourceAdapter {
  readonly country = "UK" as const;

  constructor() {
    super("uk_find_a_tender", true);
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
      const url = new URL(UK_FIND_A_TENDER_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (UK_FIND_A_TENDER_API_KEY) {
        headers["Authorization"] = `Bearer ${UK_FIND_A_TENDER_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] UK Find a Tender API returned ${resp.status}`,
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
          sourceName: "uk_find_a_tender",
          country: "UK",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://www.find-tender.service.gov.uk/Notice/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] UK Find a Tender adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new UkFindATenderAdapter();