/**
 * US SAM.gov — federal contract opportunities.
 *
 * Key-authenticated. Requires:
 *   SAM_GOV_API_KEY
 * https://api.sam.gov/opportunities/v2/search
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJson,
  inferOpportunityType,
  inferSector,
  parseAmount,
  pickString,
  toIsoDate,
  truncate,
} from "./http";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalSourceAdapter,
} from "./types";

const DEFAULT_API_URL = "https://api.sam.gov/opportunities/v2/search";

export class UsSamAdapter implements SignalSourceAdapter {
  readonly name = "us-sam";
  readonly jurisdiction = "US" as const;
  readonly enabled = Boolean(process.env.SAM_GOV_API_KEY?.trim());

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const apiKey = process.env.SAM_GOV_API_KEY?.trim();
    if (!apiKey) return [];

    const since =
      options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const url = new URL(
      process.env.SAM_GOV_API_URL?.trim() || DEFAULT_API_URL,
    );
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("postedFrom", since.toISOString().slice(0, 10));
    url.searchParams.set("postedTo", new Date().toISOString().slice(0, 10));
    url.searchParams.set("limit", String(clampLimit(options?.limit)));
    url.searchParams.set("offset", "0");
    url.searchParams.set("isActive", "true");

    const data = await fetchJson<unknown>(url);
    if (!data) return [];

    const root = asRecord(data);
    const opportunities = asArray(
      root.opportunitiesData ?? root.opportunities ?? root.results,
    );

    return opportunities.flatMap((entry) => {
      const item = asRecord(entry);
      const noticeId = pickString(
        item.noticeId,
        item.notice_id,
        item.solicitationNumber,
        item.id,
      );
      const title = pickString(item.title, item.solicitationNumber);
      if (!noticeId || !title) return [];

      const buyerName =
        pickString(
          item.fullParentPathName,
          item.organizationName,
          item.departmentName,
          item.agencyName,
        ) ?? "US federal agency";
      const description = pickString(item.description) ?? "";
      const text = `${title} ${description} ${pickString(item.naicsCode) ?? ""}`;
      const sector = inferSector(text, "PUBLIC_SECTOR");
      const opportunityType = inferOpportunityType(text, "PROCUREMENT");
      const estimatedValue = parseAmount(
        asRecord(item.award).amount ?? item.estimatedValue,
      );
      const sourceUrl =
        pickString(item.uiLink, item.url) ??
        `https://sam.gov/opp/${encodeURIComponent(noticeId)}/view`;

      return [
        {
          title: truncate(title, 240),
          buyerName,
          jurisdiction: "US" as const,
          sector,
          opportunityType,
          estimatedValue,
          sourceName: "SAM.gov",
          sourceUrl,
          sourceId: noticeId,
          commercialWhy: buildCommercialWhy({
            buyerName,
            sector,
            opportunityType,
            estimatedValue,
          }),
          publishedAt: toIsoDate(item.postedDate),
          rawPayload: { opportunity: item },
        },
      ];
    });
  }
}

const usSamAdapter = new UsSamAdapter();
export default usSamAdapter;
