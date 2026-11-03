/**
 * UK Planning Data — planning applications / permits.
 *
 * Free, unauthenticated feed from the Planning Data platform.
 * https://www.planning.data.gov.uk/entity.json
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
  SignalSourceAdapter,
} from "./types";

const DEFAULT_API_URL = "https://www.planning.data.gov.uk/entity.json";

export class UkPlanningAdapter implements SignalSourceAdapter {
  readonly name = "uk-planning";
  readonly jurisdiction = "UK" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const url = new URL(
      process.env.UK_PLANNING_API_URL?.trim() || DEFAULT_API_URL,
    );
    url.searchParams.set("dataset", "planning-application");
    url.searchParams.set("limit", String(clampLimit(options?.limit)));

    const data = await fetchJson<unknown>(url);
    if (!data) return [];

    const root = asRecord(data);
    const entities = asArray(
      root.entities ?? root.results ?? root.data ?? data,
    );

    return entities.flatMap((entry) => {
      const entity = asRecord(entry);
      const entityId = pickString(
        entity.entity,
        entity.reference,
        entity.id,
      );
      const description = pickString(
        entity.description,
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

      const text = `${description} ${pickString(entity.dataset) ?? ""}`;
      const sector = inferSector(text, "CONSTRUCTION");
      const estimatedValue = parseAmount(entity.value);

      return [
        {
          title: truncate(`Planning permit: ${description}`, 240),
          buyerName,
          jurisdiction: "UK" as const,
          sector,
          opportunityType: "PROJECT" as const,
          estimatedValue,
          sourceName: "Planning Permits",
          sourceUrl,
          sourceId: entityId ?? sourceUrl,
          commercialWhy: buildCommercialWhy({
            buyerName,
            sector,
            opportunityType: "PROJECT",
            estimatedValue,
          }),
          publishedAt: pickString(entity["start-date"], entity.startDate),
          rawPayload: { entity },
        },
      ];
    });
  }
}

const ukPlanningAdapter = new UkPlanningAdapter();
export default ukPlanningAdapter;
