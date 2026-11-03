/**
 * Shared TED (Tenders Electronic Daily) client.
 *
 * The legacy `https://data.ted.europa.eu/sparql` endpoint is retired and now
 * returns 404. The supported public replacement is the v3 notices search API,
 * which accepts anonymous requests and an optional bearer token.
 *
 * https://api.ted.europa.eu/v3/notices/search
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJsonWithBackoff,
  inferOpportunityType,
  inferSector,
  localisedText,
  parseAmount,
  pickString,
  sleep,
  toIsoDate,
  truncate,
  withinWindow,
} from "./http";
import type { IngestionOptions, NormalisedSignal } from "./types";

export const TED_API_URL = "https://api.ted.europa.eu/v3/notices/search";

const PAGE_DELAY_MS = 500;

/**
 * Fetches a single page of TED notices within [since, until] and normalises
 * them into the unified signals schema. Pass an API key to authenticate;
 * anonymous access also works. Callers paginate by incrementing `options.page`.
 */
export async function fetchTedNotices(
  options?: IngestionOptions,
  apiKey?: string,
): Promise<NormalisedSignal[]> {
  const since = options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const until = options?.until ?? new Date();
  const sinceCompact = since.toISOString().slice(0, 10).replace(/-/g, "");
  const untilCompact = until.toISOString().slice(0, 10).replace(/-/g, "");
  const page = options?.page ?? 1;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const data = await fetchJsonWithBackoff<unknown>(
    process.env.TED_EU_API_URL?.trim() || TED_API_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `publication-date >= ${sinceCompact} AND publication-date <= ${untilCompact}`,
        fields: [
          "publication-number",
          "notice-title",
          "buyer-name",
          "total-value",
          "publication-date",
          "notice-type",
          "links",
        ],
        limit: clampLimit(options?.limit),
        page,
      }),
    },
  );
  if (!data) return [];

  const root = asRecord(data);
  const notices = asArray(root.notices ?? root.results ?? root.data);

  return notices.flatMap((entry) => {
    const notice = asRecord(entry);
    const publicationDate = toIsoDate(
      localisedText(notice["publication-date"] ?? notice.publicationDate),
    );
    if (publicationDate && !withinWindow(publicationDate, since, until))
      return [];

    const publicationNumber = localisedText(
      notice["publication-number"] ?? notice.publicationNumber,
    );
    const title = localisedText(notice["notice-title"] ?? notice.title);
    if (!title) return [];

    const sourceId =
      publicationNumber ?? pickString(notice["notice-id"], title) ?? title;
    const buyerName =
      localisedText(notice["buyer-name"] ?? notice.buyerName) ??
      "European contracting authority";
    const estimatedValue = parseAmount(
      notice["total-value"] ?? notice.totalValue,
    );
    const noticeType = localisedText(
      notice["notice-type"] ?? notice.noticeType,
    );
    const text = `${title} ${buyerName} ${noticeType ?? ""}`;
    const sector = inferSector(text, "PUBLIC_SECTOR");
    const opportunityType = inferOpportunityType(text, "PROCUREMENT");

    const links = asRecord(notice.links);
    const xmlLinks = asRecord(links.xml);
    const pdfLinks = asRecord(links.pdf);
    const sourceUrl =
      pickString(xmlLinks.MUL, xmlLinks.ENG, pdfLinks.ENG) ??
      `https://ted.europa.eu/en/notice/${encodeURIComponent(sourceId)}/xml`;

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
        publishedAt: publicationDate,
        rawPayload: { notice },
      },
    ];
  });
}

/** Fetches every page of TED notices within [since, until], up to maxPages. */
export async function fetchTedNoticesAllPages(
  options: IngestionOptions,
  apiKey?: string,
): Promise<NormalisedSignal[]> {
  const limit = clampLimit(options?.limit);
  const maxPages = options?.maxPages ?? 1;
  const all: NormalisedSignal[] = [];
  let page = options?.page ?? 1;

  while (page <= maxPages) {
    const pageOptions: IngestionOptions = {
      ...options,
      page,
      limit,
    };
    const notices = await fetchTedNotices(pageOptions, apiKey);
    all.push(...notices);
    if (notices.length < limit) break;
    page++;
    await sleep(PAGE_DELAY_MS);
  }

  return all;
}
