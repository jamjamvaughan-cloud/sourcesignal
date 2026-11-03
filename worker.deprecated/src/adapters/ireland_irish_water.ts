/**
 * Ireland Irish Water / Uisce Éireann source adapter.
 *
 * Discovers procurement opportunities from Irish Water (Uisce Éireann)
 * procurement portal.
 *
 * Official Portal: https://www.water.ie/business-developers/procurement/
 * Note: Irish Water publishes procurement opportunities via eTenders (etenders.gov.ie).
 * This adapter uses the eTenders OCDS feed filtered for Irish Water as the buyer.
 *
 * Configuration:
 *   IRELAND_IRISH_WATER_API_URL - Base URL for the eTenders OCDS API
 *   IRELAND_IRISH_WATER_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const IRELAND_IRISH_WATER_API_URL =
  process.env.IRELAND_IRISH_WATER_API_URL ||
  "https://www.etenders.gov.ie/ocds";

const IRELAND_IRISH_WATER_API_KEY = process.env.IRELAND_IRISH_WATER_API_KEY;

export class IrelandIrishWaterAdapter extends BaseSourceAdapter {
  readonly country = "IE" as const;

  constructor() {
    super("ireland_irish_water", true);
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
      const url = new URL(IRELAND_IRISH_WATER_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      // Filter for Irish Water / Uisce Éireann as buyer
      url.searchParams.set("buyer", "Irish Water");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (IRELAND_IRISH_WATER_API_KEY) {
        headers["Authorization"] = `Bearer ${IRELAND_IRISH_WATER_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] Irish Water API returned ${resp.status}`,
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

      const iwRecords = rawArray.filter((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const buyer = String(raw.buyer ?? raw.buyerName ?? raw.organisation ?? "").toLowerCase();
        return buyer.includes("irish water") ||
          buyer.includes("uisce éireann") ||
          buyer.includes("uisce eireann");
      });

      const records: SourceRecord[] = iwRecords.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const ocid = raw.ocid ?? raw.id ?? tender?.id ?? "";
        const region = String(raw.region ?? tender?.region ?? "IE").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "ireland_irish_water",
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
        `[worker] Irish Water adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new IrelandIrishWaterAdapter();