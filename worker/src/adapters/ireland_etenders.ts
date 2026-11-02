/**
 * Ireland eTenders source adapter.
 *
 * Discovers procurement opportunities from Ireland's eTenders platform
 * (https://www.etenders.gov.ie/) - the Irish Government's electronic
 * tendering platform.
 *
 * Official API Reference: https://www.etenders.gov.ie/api
 * OCDS Feed: https://www.etenders.gov.ie/ocds
 * RSS Feed: https://www.etenders.gov.ie/rss
 *
 * Configuration:
 *   IRELAND_ETENDERS_API_URL - Base URL for the eTenders OCDS API
 *   IRELAND_ETENDERS_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const IRELAND_ETENDERS_API_URL =
  process.env.IRELAND_ETENDERS_API_URL ||
  "https://www.etenders.gov.ie/ocds";

const IRELAND_ETENDERS_API_KEY = process.env.IRELAND_ETENDERS_API_KEY;

export class IrelandETendersAdapter extends BaseSourceAdapter {
  readonly country = "IE" as const;

  constructor() {
    super("ireland_etenders", true);
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
      const url = new URL(IRELAND_ETENDERS_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (IRELAND_ETENDERS_API_KEY) {
        headers["Authorization"] = `Bearer ${IRELAND_ETENDERS_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Ireland eTenders API returned ${resp.status}`,
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
        const region = String(raw.region ?? tender?.region ?? "IE").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "ireland_etenders",
          country: "IE",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://www.etenders.gov.ie/tender/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] Ireland eTenders adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new IrelandETendersAdapter();