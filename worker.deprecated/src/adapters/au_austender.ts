/**
 * Australia AusTender source adapter.
 *
 * Discusses federal procurement from Australia's AusTender portal.
 */
import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const AU_AUSTENDER_API_URL =
  process.env.AU_AUSTENDER_API_URL || "https://www.tenders.gov.au/api/";

export class AusTenderAdapter extends BaseSourceAdapter {
  readonly country = "AU" as const;

  constructor() {
    super("au_austender", true);
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
      const url = new URL(AU_AUSTENDER_API_URL);
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
          (data as Record<string, unknown>).opportunities ||
          (data as Record<string, unknown>).items ||
          []) as unknown[];

      const records: SourceRecord[] = rawArray.map((item) => {
        const raw = item as Record<string, unknown>;
        const region = String(raw.region ?? "AU").toUpperCase();
        return {
          sourceId: String(raw.id ?? raw.tender_id ?? ""),
          sourceName: "au_austender",
          country: "AU",
          sourceUrl: String(raw.url ?? `https://www.tenders.gov.au/tender/${raw.id ?? ""}`),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error("[worker] AusTender adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new AusTenderAdapter();
