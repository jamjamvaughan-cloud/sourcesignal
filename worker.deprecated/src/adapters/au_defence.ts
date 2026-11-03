/**
 * Australia Defence Procurement source adapter.
 *
 * Discusses defence procurement from the Australian Tenders OCDS API,
 * filtered to the Department of Defence as the agency.
 *
 * Official API: https://api.tenders.gov.au/ocds/v1/releases/
 * Query parameter: agencyName=Department of Defence
 *
 * Configuration:
 *   AU_DEFENCE_API_URL - Override for the Australian Tenders OCDS endpoint
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const AU_DEFENCE_API_URL =
  process.env.AU_DEFENCE_API_URL ||
  "https://api.tenders.gov.au/ocds/v1/releases/?agencyName=Department%20of%20Defence";

export class AUDefenceAdapter extends BaseSourceAdapter {
  readonly country = "AU" as const;

  constructor() {
    super("au_defence", true);
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
      const url = new URL(AU_DEFENCE_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      url.searchParams.set("limit", "100");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      const resp = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] AU Defence (api.tenders.gov.au) API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;
      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).results ||
          (data as Record<string, unknown>).releases ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const publishedAfterMs = new Date(params.publishedAfter).getTime();
      const records: SourceRecord[] = [];

      for (const item of rawArray) {
        const raw = item as Record<string, unknown>;
        // OCDS release wrapper: the actual release may be nested.
        const release = (raw.release ?? raw) as Record<string, unknown>;
        const id = String(
          release.id ?? raw.id ?? raw.ocid ?? raw.tender_id ?? "",
        );

        // Client-side date filtering.
        const dateStr =
          String(
            release.date ??
              raw.date ??
              raw.published_date ??
              raw.publishedDate ??
              "",
          ) ?? "";
        if (dateStr) {
          const recordDate = new Date(dateStr).getTime();
          if (recordDate < publishedAfterMs) {
            continue;
          }
        }

        const region = String(raw.region ?? "AU").toUpperCase();

        records.push({
          sourceId: id,
          sourceName: "au_defence",
          country: "AU",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              `https://api.tenders.gov.au/ocds/v1/releases/${id}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error("[worker] AU Defence adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new AUDefenceAdapter();
