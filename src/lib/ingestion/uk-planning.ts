/**
 * UK Planning Data — planning applications, permits, and conditions.
 *
 * Free, unauthenticated feed from the Planning Data platform.
 * https://www.planning.data.gov.uk/entity.json
 *
 * The `planning-application` dataset is currently empty on the public API, so
 * the adapter falls back to the published `planning-condition` dataset. Those
 * records are treated as compliance signals tied to consented development.
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJson,
  inferSector,
  parseAmount,
  pickString,
  truncate,
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

async function fetchEntities(
  dataset: PlanningDataset,
  options?: IngestionOptions,
): Promise<unknown[]> {
  const url = new URL(
    process.env.UK_PLANNING_API_URL?.trim() || DEFAULT_API_URL,
  );
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("limit", String(clampLimit(options?.limit)));

  const data = await fetchJson<unknown>(url);
  if (!data) return [];

  const root = asRecord(data);
  return asArray(root.entities ?? root.results ?? root.data ?? data);
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
      ),
      rawPayload: { entity, dataset },
    },
  ];
}

export class UkPlanningAdapter implements SignalSourceAdapter {
  readonly name = "uk-planning";
  readonly jurisdiction = "UK" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    for (const dataset of DATASETS) {
      const entities = await fetchEntities(dataset, options);
      if (entities.length > 0) {
        return entities.flatMap((entry) => mapEntity(entry, dataset));
      }
    }
    return [];
  }
}

const ukPlanningAdapter = new UkPlanningAdapter();
export default ukPlanningAdapter;
