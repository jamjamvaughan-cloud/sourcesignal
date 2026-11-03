/**
 * TED EU — notices search API (v3).
 *
 * Key-authenticated. Requires:
 *   TED_EU_API_KEY
 * https://api.ted.europa.eu/v3/notices/search
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJson,
  inferOpportunityType,
  inferSector,
  localisedText,
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

const DEFAULT_API_URL = "https://api.ted.europa.eu/v3/notices/search";

export class EuTedApiAdapter implements SignalSourceAdapter {
  readonly name = "eu-ted-api";
  readonly jurisdiction = "EU" as const;
  readonly enabled = Boolean(process.env.TED_EU_API_KEY?.trim());

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const apiKey = process.env.TED_EU_API_KEY?.trim();
    if (!apiKey) return [];

    const since =
      options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sinceCompact = since.toISOString().slice(0, 10).replace(/-/g, "");
    const url = process.env.TED_EU_API_URL?.trim() || DEFAULT_API_URL;

    const body = {
      query: `publication-date >= ${sinceCompact}`,
      fields: [
        "publication-number",
        "notice-title",
        "buyer-name",
        "total-value",
        "estimated-value",
        "publication-date",
        "notice-type",
        "notice-url",
      ],
      limit: clampLimit(options?.limit),
      page: 1,
    };

    const data = await fetchJson<unknown>(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!data) return [];

    const root = asRecord(data);
    const notices = asArray(root.notices ?? root.results ?? root.data);

    return notices.flatMap((entry) => {
      const notice = asRecord(entry);
      const publicationNumber = localisedText(
        notice["publication-number"] ?? notice.publicationNumber,
      );
      const title = localisedText(
        notice["notice-title"] ?? notice.title,
      );
      if (!title) return [];

      const sourceId =
        publicationNumber ?? pickString(notice["notice-id"], title) ?? title;
      const buyerName =
        localisedText(notice["buyer-name"] ?? notice.buyerName) ??
        "European contracting authority";
      const estimatedValue = parseAmount(
        notice["total-value"] ??
          notice.totalValue ??
          notice["estimated-value"] ??
          notice.estimatedValue,
      );
      const text = `${title} ${buyerName} ${localisedText(notice["notice-type"]) ?? ""}`;
      const sector = inferSector(text, "PUBLIC_SECTOR");
      const opportunityType = inferOpportunityType(text, "PROCUREMENT");
      const sourceUrl =
        localisedText(notice["notice-url"] ?? notice.noticeUrl) ??
        `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(sourceId)}`;

      return [
        {
          title: truncate(title, 240),
          buyerName,
          jurisdiction: "EU" as const,
          sector,
          opportunityType,
          estimatedValue,
          sourceName: "TED EU",
          sourceUrl,
          sourceId,
          commercialWhy: buildCommercialWhy({
            buyerName,
            sector,
            opportunityType,
            estimatedValue,
          }),
          publishedAt: toIsoDate(
            localisedText(
              notice["publication-date"] ?? notice.publicationDate,
            ),
          ),
          rawPayload: { notice },
        },
      ];
    });
  }
}

const euTedApiAdapter = new EuTedApiAdapter();
export default euTedApiAdapter;
