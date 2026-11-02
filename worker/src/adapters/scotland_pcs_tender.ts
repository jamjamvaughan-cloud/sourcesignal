/**
 * Scotland PCS Tender (Jaggaer) source adapter.
 *
 * Discovers procurement opportunities from the Scotland PCS Tender portal
 * (Jaggaer eProcurement platform used by Scottish public sector).
 *
 * Official Portal: https://www.publiccontractsscotland.gov.uk/
 * Note: The PCS Tender (Jaggaer) platform does not expose a public REST API.
 * This adapter uses the Public Contracts Scotland OCDS feed as the primary source,
 * filtered for tender-stage notices.
 *
 * Configuration:
 *   SCOTLAND_PCS_TENDER_API_URL - Base URL for the PCS OCDS API
 *   SCOTLAND_PCS_TENDER_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const SCOTLAND_PCS_TENDER_API_URL =
  process.env.SCOTLAND_PCS_TENDER_API_URL ||
  "https://www.publiccontractsscotland.gov.uk/ocds";

const SCOTLAND_PCS_TENDER_API_KEY = process.env.SCOTLAND_PCS_TENDER_API_KEY;

export class ScotlandPCSTenderAdapter extends BaseSourceAdapter {
  readonly country = "UK" as const;

  constructor() {
    super("scotland_pcs_tender", true);
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
      const url = new URL(SCOTLAND_PCS_TENDER_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      // Filter for tender-stage notices (ITT, Contract Notice, etc.)
      url.searchParams.set("noticeType", "Contract Notice");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (SCOTLAND_PCS_TENDER_API_KEY) {
        headers["Authorization"] = `Bearer ${SCOTLAND_PCS_TENDER_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Scotland PCS-Tender API returned ${resp.status}`,
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

      const tenderRecords = rawArray.filter((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const noticeType = String(raw.tag ?? tender?.noticeType ?? "").toLowerCase();
        return noticeType.includes("contract notice") ||
          noticeType.includes("itt") ||
          noticeType.includes("tender");
      });

      const records: SourceRecord[] = tenderRecords.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const ocid = raw.ocid ?? raw.id ?? tender?.id ?? "";
        const region = String(raw.region ?? tender?.region ?? "SCT").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "scotland_pcs_tender",
          country: "UK",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://www.publiccontractsscotland.gov.uk/tender/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] Scotland PCS-Tender adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new ScotlandPCSTenderAdapter();