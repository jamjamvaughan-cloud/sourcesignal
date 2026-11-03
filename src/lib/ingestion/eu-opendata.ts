/**
 * EU Open Data Portal — procurement and policy dataset releases.
 *
 * Free, unauthenticated search API.
 * https://data.europa.eu/api/hub/store/search
 *
 * These records are policy/programme signals rather than individual tenders.
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJson,
  localisedText,
  pickString,
  truncate,
} from "./http";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalSourceAdapter,
} from "./types";

const DEFAULT_API_URL = "https://data.europa.eu/api/hub/store/search";

export class EuOpenDataAdapter implements SignalSourceAdapter {
  readonly name = "eu-opendata";
  readonly jurisdiction = "EU" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const url = new URL(
      process.env.EU_OPEN_DATA_API_URL?.trim() || DEFAULT_API_URL,
    );
    url.searchParams.set("query", "public procurement");
    url.searchParams.set("limit", String(clampLimit(options?.limit)));
    url.searchParams.set("format", "json");

    const data = await fetchJson<unknown>(url);
    if (!data) return [];

    const root = asRecord(data);
    const result = asRecord(root.result);
    const items = asArray(
      root.results ?? result.results ?? result.items ?? root.data ?? data,
    );

    return items.flatMap((entry) => {
      const item = asRecord(entry);
      const title = localisedText(item.title) ?? localisedText(item.name);
      if (!title) return [];

      const sourceUrl =
        pickString(
          item.landingPage,
          item.landing_page,
          item.url,
          item.uri,
        ) ??
        (pickString(item.identifier)?.startsWith("http")
          ? pickString(item.identifier)
          : undefined);
      if (!sourceUrl) return [];

      const sourceId =
        pickString(item.identifier, item.id, item.uri, title) ?? title;
      const publisher = asRecord(item.publisher);
      const buyerName =
        localisedText(item.publisher) ??
        pickString(publisher.name, publisher.title) ??
        "European Union";
      const description =
        localisedText(item.description) ?? localisedText(item.notes) ?? "";

      return [
        {
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
          publishedAt: pickString(item.issued, item.modified, item.updated),
          rawPayload: { dataset: item, description },
        },
      ];
    });
  }
}

const euOpenDataAdapter = new EuOpenDataAdapter();
export default euOpenDataAdapter;
