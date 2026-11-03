/**
 * GOV.UK Find a Tender — OCDS release packages.
 *
 * Free, unauthenticated UK e-notification feed for above-threshold contracts.
 * https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages
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

const DEFAULT_API_URL =
  "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";

export class UkTendersAdapter implements SignalSourceAdapter {
  readonly name = "uk-tenders";
  readonly jurisdiction = "UK" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since =
      options?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const url = new URL(
      process.env.UK_FIND_A_TENDER_API_URL?.trim() || DEFAULT_API_URL,
    );
    // Find a Tender expects local datetimes without a timezone suffix, e.g.
    // "2026-11-03T09:00:00". Date-only or trailing "Z" values return 400.
    const ocdsDate = (date: Date) => date.toISOString().slice(0, 19);
    url.searchParams.set("updatedFrom", ocdsDate(since));
    url.searchParams.set("updatedTo", ocdsDate(new Date()));
    url.searchParams.set("limit", String(clampLimit(options?.limit)));

    const data = await fetchJson<unknown>(url);
    if (!data) return [];

    const root = asRecord(data);
    const releases = asArray(root.releases ?? root.results ?? data);

    return releases.flatMap((entry) => {
      const release = asRecord(entry);
      const tender = asRecord(release.tender);
      const buyerParty = asArray(release.parties)
        .map(asRecord)
        .find((party) => asArray(party.roles).includes("buyer"));

      const title = pickString(
        tender.title,
        release.title,
        tender.description,
        release.ocid,
        release.id,
      );
      if (!title) return [];

      const buyerName =
        pickString(
          asRecord(buyerParty).name,
          asRecord(tender.procuringEntity).name,
        ) ?? "Undisclosed public buyer";
      const sourceId = pickString(release.ocid, release.id, title) ?? title;
      const sourceUrl =
        pickString(release.url, asRecord(tender).url) ??
        `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(sourceId)}`;
      const description = pickString(tender.description) ?? "";
      const text = `${title} ${description} ${pickString(tender.mainProcurementCategory) ?? ""}`;
      const sector = inferSector(text, "PUBLIC_SECTOR");
      const opportunityType = inferOpportunityType(text, "PROCUREMENT");
      const estimatedValue =
        parseAmount(asRecord(tender.value).amount) ??
        parseAmount(asRecord(release.value).amount);
      const publishedAt = toIsoDate(
        pickString(release.date, release.publishedDate, tender.datePublished),
      );

      return [
        {
          title: truncate(title, 240),
          buyerName,
          jurisdiction: "UK" as const,
          sector,
          opportunityType,
          estimatedValue,
          sourceName: "GOV.UK Find a Tender",
          sourceUrl,
          sourceId,
          commercialWhy: buildCommercialWhy({
            buyerName,
            sector,
            opportunityType,
            estimatedValue,
          }),
          publishedAt,
          rawPayload: { release },
        },
      ];
    });
  }
}

const ukTendersAdapter = new UkTendersAdapter();
export default ukTendersAdapter;
