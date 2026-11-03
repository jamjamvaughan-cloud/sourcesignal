/**
 * TED EU — SPARQL endpoint.
 *
 * Free, unauthenticated access to the EU Tenders Electronic Daily linked-data
 * store. https://data.ted.europa.eu/sparql
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

const DEFAULT_SPARQL_URL = "https://data.ted.europa.eu/sparql";

function bindingValue(
  row: Record<string, unknown>,
  key: string,
): string | undefined {
  return pickString(asRecord(row[key]).value);
}

export class EuTedSparqlAdapter implements SignalSourceAdapter {
  readonly name = "eu-ted-sparql";
  readonly jurisdiction = "EU" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since =
      options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const limit = clampLimit(options?.limit);

    const query = `
PREFIX epo: <http://data.europa.eu/a4g/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?notice ?title ?buyerName ?value ?publicationDate
WHERE {
  ?notice a epo:Notice ;
          epo:hasPublicationDate ?publicationDate .
  OPTIONAL { ?notice epo:hasTitle ?title }
  OPTIONAL {
    ?notice epo:hasBuyer ?buyer .
    ?buyer epo:hasName ?buyerName
  }
  OPTIONAL { ?notice epo:hasEstimatedValue ?value }
  FILTER(?publicationDate >= "${since.toISOString()}"^^xsd:dateTime)
}
ORDER BY DESC(?publicationDate)
LIMIT ${limit}`;

    const url = new URL(
      process.env.TED_SPARQL_URL?.trim() || DEFAULT_SPARQL_URL,
    );
    url.searchParams.set("query", query);
    url.searchParams.set("format", "application/sparql-results+json");

    const data = await fetchJson<unknown>(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!data) return [];

    const bindings = asArray(asRecord(asRecord(data).results).bindings);

    return bindings.flatMap((entry) => {
      const row = asRecord(entry);
      const noticeUri = bindingValue(row, "notice");
      if (!noticeUri) return [];

      const noticeId = noticeUri.split("/").filter(Boolean).pop() ?? noticeUri;
      const title =
        bindingValue(row, "title") ?? `TED notice ${noticeId}`;
      const buyerName =
        bindingValue(row, "buyerName") ?? "European contracting authority";
      const estimatedValue = parseAmount(bindingValue(row, "value"));
      const text = `${title} ${buyerName}`;
      const sector = inferSector(text, "PUBLIC_SECTOR");
      const opportunityType = inferOpportunityType(text, "PROCUREMENT");

      return [
        {
          title: truncate(title, 240),
          buyerName,
          jurisdiction: "EU" as const,
          sector,
          opportunityType,
          estimatedValue,
          sourceName: "TED EU",
          sourceUrl: noticeUri.startsWith("http")
            ? noticeUri
            : `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(noticeId)}`,
          sourceId: noticeId,
          commercialWhy: buildCommercialWhy({
            buyerName,
            sector,
            opportunityType,
            estimatedValue,
          }),
          publishedAt: toIsoDate(bindingValue(row, "publicationDate")),
          rawPayload: { binding: row },
        },
      ];
    });
  }
}

const euTedSparqlAdapter = new EuTedSparqlAdapter();
export default euTedSparqlAdapter;
