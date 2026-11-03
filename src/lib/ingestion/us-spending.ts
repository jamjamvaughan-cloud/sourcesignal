/**
 * USAspending.gov — federal award and contract spending.
 *
 * Free, unauthenticated API. We query recent awards sorted by value so the
 * feed surfaces material commercial activity rather than low-value noise.
 * https://api.usaspending.gov/api/v2/search/spending_by_award/
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
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

export class UsSpendingAdapter implements SignalSourceAdapter {
  readonly name = "us-spending";
  readonly jurisdiction = "US" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since =
      options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const url =
      process.env.USASPENDING_API_URL?.trim() || DEFAULT_API_URL;

    const body = {
      filters: {
        award_type_codes: ["A", "B", "C", "D"],
        time_period: [
          {
            start_date: since.toISOString().slice(0, 10),
            end_date: new Date().toISOString().slice(0, 10),
          },
        ],
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Description",
        "Start Date",
        "End Date",
        "generated_internal_id",
      ],
      page: 1,
      limit: clampLimit(options?.limit),
      sort: "Award Amount",
      order: "desc",
      subawards: false,
    };

    const data = await fetchJson<unknown>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!data) return [];

    const results = asArray(asRecord(data).results);

    return results.flatMap((entry) => {
      const row = asRecord(entry);
      const awardId = pickString(row["Award ID"]);
      const internalId = pickString(row["generated_internal_id"], awardId);
      if (!internalId && !awardId) return [];

      const description =
        pickString(row["Description"]) ?? `Federal award ${awardId ?? ""}`;
      const recipient = pickString(row["Recipient Name"]);
      const buyerName =
        pickString(
          row["Awarding Sub Agency"],
          row["Awarding Agency"],
          recipient,
        ) ?? "US federal agency";
      const text = `${description} ${buyerName} ${recipient ?? ""}`;
      const sector = inferSector(text, "PUBLIC_SECTOR");
      const opportunityType = inferOpportunityType(text, "PROCUREMENT");
      const estimatedValue = parseAmount(row["Award Amount"]);
      const sourceId = internalId ?? awardId ?? description;

      return [
        {
          title: truncate(description, 240),
          buyerName,
          jurisdiction: "US" as const,
          sector,
          opportunityType,
          estimatedValue,
          sourceName: "USAspending",
          sourceUrl: `https://www.usaspending.gov/award/${encodeURIComponent(sourceId)}`,
          sourceId,
          commercialWhy: buildCommercialWhy({
            buyerName,
            sector,
            opportunityType,
            estimatedValue,
          }),
          publishedAt: toIsoDate(row["Start Date"]),
          rawPayload: { award: row },
        },
      ];
    });
  }
}

const usSpendingAdapter = new UsSpendingAdapter();
export default usSpendingAdapter;
