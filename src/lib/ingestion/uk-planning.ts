/**
 * UK Planning Data — planning applications, permits, and conditions.
 *
 * Free, unauthenticated feed from the Planning Data platform.
 * https://www.planning.data.gov.uk/entity.json
 *
 * The `planning-application` dataset is currently empty on the public API, so
 * the adapter falls back to the populated `planning-condition` dataset. Those
 * records are treated as compliance signals tied to consented development.
 *
 * Pagination follows `links.next` (offset-based) until exhausted or
 * `maxPages` is reached, filtering records to the requested date window via
 * `entry-date`/`start-date`.
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJsonWithBackoff,
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
  SignalOpportunityType,
  SignalSourceAdapter,
} from "./types";

const DEFAULT_API_URL = "https://www.planning.data.gov.uk/entity.json";

/** Primary permit feed first, then the populated condition feed. */
const DATASETS = ["planning-application", "planning-condition"] as const;
type PlanningDataset = (typeof DATASETS)[number];

const PAGE_DELAY_MS = 500;

async function fetchEntities(
  dataset: PlanningDataset,
  baseUrl: URL,
  limit: number,
): Promise<{ entities: unknown[]; nextUrl: URL | undefined }> {
  const url = new URL(baseUrl.toString());
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("limit", String(limit));

  const data = await fetchJsonWithBackoff<unknown>(url);
  if (!data) return { entities: [], nextUrl: undefined };

  const root = asRecord(data);
  const entities = asArray(root.entities ?? root.results ?? root.data ?? data);
  const links = asRecord(root.links);
  const next = pickString(links.next);
  return {
    entities,
    nextUrl: next ? new URL(next) : undefined,
  };
}

function mapEntity(
  entry: unknown,
  dataset: PlanningDataset,
): NormalisedSignal[] {
  const entity = asRecord(entry);
  const entityId = pickString(entity.entity, entity.reference, entity.id);
  const description = pickString(
    entity.description,
    entity.notes,
    entity.reason,
    entity.name,
    entity.reference,
  );
  if (!description) return [];

  const buyerName =
    pickString(
      entity.organisation,
      entity["organisation-name"],
      entity.organisationName,
    ) ?? "Local planning authority";

  const sourceUrl =
    pickString(entity.url, entity.landingPage) ??
    (entityId
      ? `https://www.planning.data.gov.uk/entity/${encodeURIComponent(entityId)}`
      : undefined);
  if (!sourceUrl) return [];

  const isCondition = dataset === "planning-condition";
  const opportunityType: SignalOpportunityType = isCondition
    ? "COMPLIANCE"
    : "PROJECT";
  const text = `${description} ${pickString(entity.dataset) ?? ""}`;
  const sector = inferSector(text, "CONSTRUCTION");
  const estimatedValue = parseAmount(entity.value);
  const prefix = isCondition ? "Planning permit condition" : "Planning permit";

  return [
    {
      title: truncate(`${prefix}: ${description}`, 240),
      buyerName,
      jurisdiction: "UK" as const,
      sector,
      opportunityType,
      estimatedValue,
      sourceName: "Planning Permits",
      sourceUrl,
      sourceId: entityId ?? sourceUrl,
      commercialWhy: buildCommercialWhy({
        buyerName,
        sector,
        opportunityType,
        estimatedValue,
      }),
      publishedAt: pickString(
        entity["start-date"],
        entity.startDate,
        entity["entry-date"],
        entity.entryDate,
      )
        ? toIsoDate(
            pickString(
              entity["start-date"],
              entity.startDate,
              entity["entry-date"],
              entity.entryDate,
            ),
          )
        : null,
      rawPayload: { entity, dataset },
    },
  ];
}

export class UkPlanningAdapter implements SignalSourceAdapter {
  readonly name = "uk-planning";
  readonly jurisdiction = "UK" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since = options?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = options?.until ?? new Date();
    const limit = clampLimit(options?.limit);
    const maxPages = options?.maxPages ?? 1;
    const baseUrl = new URL(
      process.env.UK_PLANNING_API_URL?.trim() || DEFAULT_API_URL,
    );

    const signals: NormalisedSignal[] = [];

    for (const dataset of DATASETS) {
      let nextUrl: URL | undefined = baseUrl;
      let page = 0;
      let datasetCount = 0;

      while (nextUrl && page < maxPages) {
        page++;
        const { entities, nextUrl: following } = await fetchEntities(
          dataset,
          nextUrl,
          limit,
        );

        for (const entry of entities) {
          for (const signal of mapEntity(entry as Record<string, unknown>, dataset)) {
            const publishedAt = signal.publishedAt;
            if (publishedAt && !withinWindow(publishedAt, since, until)) continue;
            signals.push(signal);
            datasetCount++;
          }
        }

        nextUrl = following;
        if (nextUrl && page < maxPages) await sleep(PAGE_DELAY_MS);
      }

      // Only fall back to the condition dataset if the primary dataset is
      // empty (as it currently is on the public API).
      if (datasetCount > 0) break;
    }

    return signals;
  }
}

const ukPlanningAdapter = new UkPlanningAdapter();
export default ukPlanningAdapter;
