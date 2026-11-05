/**
 * EU Open Data Portal — procurement and policy dataset releases.
 *
 * Free, unauthenticated search API.
 * https://data.europa.eu/api/hub/search/search
 *
 * Paginates with `page` until results are exhausted or `maxPages` is reached,
 * filtering records to the requested date window via `issued`/`modified`.
 *
 * These records are policy/programme signals rather than individual tenders.
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJsonWithBackoff,
  localisedText,
  pickString,
  sleep,
  toIsoDate,
  truncate,
  withinWindow,
} from "./http";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalSourceAdapter,
} from "./types";

const DEFAULT_API_URL = "https://data.europa.eu/api/hub/search/search";

const PAGE_DELAY_MS = 500;

export class EuOpenDataAdapter implements SignalSourceAdapter {
  readonly name = "eu-opendata";
  readonly jurisdiction = "EU" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since = options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = options?.until ?? new Date();
    const limit = clampLimit(options?.limit);
    const maxPages = options?.maxPages ?? 1;

    const url = new URL(
      process.env.EU_OPEN_DATA_API_URL?.trim() || DEFAULT_API_URL,
    );
    url.searchParams.set("query", "public procurement");
    url.searchParams.set("limit", String(limit));

    let page = 1;
    let hasMore = true;
    const signals: NormalisedSignal[] = [];

    while (hasMore && page <= maxPages) {
      url.searchParams.set("page", String(page));
      const data = await fetchJsonWithBackoff<unknown>(url);
      if (!data) break;

      const root = asRecord(data);
      const result = asRecord(root.result);
      const items = asArray(result.results);

      for (const entry of items) {
        const signal = normaliseItem(entry as Record<string, unknown>, since, until);
        if (!signal) continue;
        signals.push(signal);
      }

      hasMore = items.length === limit;
      page++;
      if (hasMore && page <= maxPages) await sleep(PAGE_DELAY_MS);
    }

    return signals;
  }
}

function normaliseItem(
  item: Record<string, unknown>,
  since: Date,
  until: Date,
): NormalisedSignal | null {
  const title = localisedText(item.title) ?? localisedText(item.name);
  if (!title) return null;

  const sourceUrl =
    pickString(
      item.homepage,
      item.landingPage,
      item.landing_page,
      item.url,
      item.uri,
    ) ??
    (pickString(item.id)?.startsWith("http")
      ? pickString(item.id)
      : undefined);
  if (!sourceUrl) return null;

  const sourceId = pickString(item.id, item.identifier, item.uri, title) ?? title;
  const publisher = asRecord(item.publisher);
  const buyerName =
    localisedText(item.publisher) ??
    pickString(publisher.name, publisher.title) ??
    "European Union";
  const description =
    localisedText(item.description) ?? localisedText(item.notes) ?? "";

  const publishedAt =
    pickString(item.issued, item.modified, item.updated) &&
    toIsoDate(pickString(item.issued, item.modified, item.updated));

  // Only keep records within the requested historical window when a date is
  // available; records without a date are retained.
  if (publishedAt && !withinWindow(publishedAt, since, until)) return null;

  return {
    title: truncate(title, 240),
    buyerName,
    jurisdiction: "EU" as const,
    sector: "PUBLIC_SECTOR" as const,
    opportunityType: "POLICY" as const,
    estimatedValue: null,
    sourceName: "EU Open Data",
    sourceUrl,
    sourceId,
    commercialWhy: buildCommercialWhy({
      buyerName,
      sector: "PUBLIC_SECTOR",
      opportunityType: "POLICY",
      estimatedValue: null,
    }),
    publishedAt,
    rawPayload: { dataset: item, description },
  };
}

const euOpenDataAdapter = new EuOpenDataAdapter();
export default euOpenDataAdapter;
