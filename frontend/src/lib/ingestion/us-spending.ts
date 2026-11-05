/**
 * USAspending.gov — federal award and contract spending.
 *
 * Free, unauthenticated API. Queries awards within a date window and paginates
 * using `page` / `page_metadata.hasNext`.
 * https://api.usaspending.gov/api/v2/search/spending_by_award/
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJsonWithBackoff,
  inferOpportunityType,
  inferSector,
  parseAmount,
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

const DEFAULT_API_URL =
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

const PAGE_DELAY_MS = 500;

export class UsSpendingAdapter implements SignalSourceAdapter {
  readonly name = "us-spending";
  readonly jurisdiction = "US" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since = options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = options?.until ?? new Date();
    const limit = clampLimit(options?.limit);
    const maxPages = options?.maxPages ?? 1;
    const url = process.env.USASPENDING_API_URL?.trim() || DEFAULT_API_URL;

    const signals: NormalisedSignal[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= maxPages) {
      const body = {
        filters: {
          award_type_codes: ["A", "B", "C", "D"],
          time_period: [
            {
              start_date: since.toISOString().slice(0, 10),
              end_date: until.toISOString().slice(0, 10),
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
        page,
        limit,
        sort: "Award Amount",
        order: "desc",
        subawards: false,
      };

      const data = await fetchJsonWithBackoff<unknown>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!data) break;

      const root = asRecord(data);
      const results = asArray(root.results);
      const metadata = asRecord(root.page_metadata);
      hasNext = Boolean(metadata.hasNext);

      for (const entry of results) {
        const row = asRecord(entry);
        const publishedAt = toIsoDate(row["Start Date"]);
        if (publishedAt && !withinWindow(publishedAt, since, until)) continue;

        const signal = normaliseRow(row);
        if (signal) signals.push(signal);
      }

      // USAspending returns awards sorted by amount, not date, so we cannot
      // safely short-circuit on a stale page; rely on maxPages instead.
      page++;
      if (hasNext && page <= maxPages) await sleep(PAGE_DELAY_MS);
    }

    return signals;
  }
}

function normaliseRow(row: Record<string, unknown>): NormalisedSignal | null {
  const awardId = pickString(row["Award ID"]);
  const internalId = pickString(row["generated_internal_id"], awardId);
  if (!internalId && !awardId) return null;

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

  return {
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
  };
}

const usSpendingAdapter = new UsSpendingAdapter();
export default usSpendingAdapter;
