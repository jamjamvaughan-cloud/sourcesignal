/**
 * EU TED (Tenders Electronic Daily) source adapter.
 *
 * Discusses procurement from EU TED - official journal of EU for public procurement.
 */
import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const EU_TED_API_URL =
  process.env.EU_TED_API_URL || "https://simap.ted.europa.eu/api/";

export class EUTEDAdapter extends BaseSourceAdapter {
  readonly country = "EU" as const;

  constructor() {
    super("eu_ted", true);
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
      const url = new URL(EU_TED_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      url.searchParams.set("limit", "100");

      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "SourceSignal/1.0" },
      });

      if (!resp.ok) return [];

      const data = (await resp.json()) as unknown;
      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).results ||
          (data as Record<string, unknown>).notices ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const records: SourceRecord[] = rawArray.map((item) => {
        const raw = item as Record<string, unknown>;
        const region = String(raw.region ?? "EU").toUpperCase();
        return {
          sourceId: String(raw.id ?? raw.notice_id ?? ""),
          sourceName: "eu_ted",
          country: "EU",
          sourceUrl: String(raw.url ?? `https://ted.europa.eu/tender/${raw.id ?? ""}`),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error("[worker] EU TED adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new EUTEDAdapter();
