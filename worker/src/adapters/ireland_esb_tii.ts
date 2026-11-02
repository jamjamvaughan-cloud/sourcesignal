/**
 * Ireland ESB/TII (Irish Semi-State Commercial Tenders) source adapter.
 *
 * Discusses procurement from Irish semi-state bodies (ESB, TII) via the
 * eTenders OCDS package endpoint, filtered to the relevant authority names.
 *
 * Official API: https://www.etenders.gov.ie/api/ocds/package/notice/
 * Query parameter: authorityName=ESB or authorityName=Transport Infrastructure Ireland
 *
 * Configuration:
 *   IRELAND_ESB_TII_API_URL - Override for the eTenders OCDS package endpoint
 *   IRELAND_ESB_TII_AUTHORITY - Authority name filter (default: ESB)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const IRELAND_ESB_TII_API_URL =
  process.env.IRELAND_ESB_TII_API_URL ||
  "https://www.etenders.gov.ie/api/ocds/package/notice/";

const IRELAND_ESB_TII_AUTHORITY =
  process.env.IRELAND_ESB_TII_AUTHORITY || "ESB";

export class IrelandESBTIIAdapter extends BaseSourceAdapter {
  readonly country = "IE" as const;

  constructor() {
    super("ireland_esb_tii", true);
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
      const url = new URL(IRELAND_ESB_TII_API_URL);
      url.searchParams.set("authorityName", IRELAND_ESB_TII_AUTHORITY);
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
          `[worker] Ireland ESB/TII (eTenders) API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;
      const packageData = data as Record<string, unknown>;
      const rawArray =
        ((packageData.notices ?? packageData.release ?? packageData) as unknown) as unknown[];

      const publishedAfterMs = new Date(params.publishedAfter).getTime();
      const records: SourceRecord[] = [];

      for (const item of rawArray) {
        const raw = item as Record<string, unknown>;
        const id =
          raw.id ?? raw.ocid ?? raw.notice_id ?? raw.noticeId ?? "";

        // Client-side date filtering.
        const dateStr =
          String(raw.date ?? raw.published_date ?? raw.publishedDate ?? "");
        if (dateStr) {
          const recordDate = new Date(dateStr).getTime();
          if (recordDate < publishedAfterMs) {
            continue;
          }
        }

        const region = String(raw.region ?? "IE").toUpperCase();

        records.push({
          sourceId: String(id),
          sourceName: "ireland_esb_tii",
          country: "IE",
          sourceUrl: String(
            raw.source_url ?? raw.url ?? `https://www.etenders.gov.ie/tender/${id}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error("[worker] Ireland ESB/TII adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new IrelandESBTIIAdapter();
