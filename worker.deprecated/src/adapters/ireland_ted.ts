/**
 * Ireland TED (Tenders Electronic Daily) source adapter.
 *
 * Discovers high-value Irish procurement opportunities from the EU's
 * Tenders Electronic Daily (TED) database, filtered for Ireland.
 * Covers contracts above EU thresholds published in the Supplement to the
 * Official Journal of the European Union.
 *
 * Official TED API: https://ted.europa.eu/api
 * TED eForms API: https://ted.europa.eu/eforms/api
 * Ireland Partition: Filter by country code "IE" in TED notices.
 *
 * Configuration:
 *   IRELAND_TED_API_URL - Base URL for the TED eForms API
 *   IRELAND_TED_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const IRELAND_TED_API_URL =
  process.env.IRELAND_TED_API_URL ||
  "https://ted.europa.eu/eforms/api/notices";

const IRELAND_TED_API_KEY = process.env.IRELAND_TED_API_KEY;

export class IrelandTEDAdapter extends BaseSourceAdapter {
  constructor() {
    super("ireland_ted", true);
  }

  async discover(): Promise<SourceRecord[]> {
    try {
      const url = new URL(IRELAND_TED_API_URL);
      url.searchParams.set("country", "IE");
      url.searchParams.set("publishedFrom", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      url.searchParams.set("limit", "100");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (IRELAND_TED_API_KEY) {
        headers["Authorization"] = `Bearer ${IRELAND_TED_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Ireland TED API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).notices ||
          (data as Record<string, unknown>).results ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const records: SourceRecord[] = rawArray.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const noticeId = raw.noticeId ?? raw.id ?? raw.ocid ?? "";
        return {
          sourceId: String(noticeId),
          sourceName: "ireland_ted",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              `https://ted.europa.eu/udl?uri=TED:NOTICE:${noticeId}:TEXT:EN:HTML`,
          ),
          rawPayload: raw,
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] Ireland TED adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new IrelandTEDAdapter();