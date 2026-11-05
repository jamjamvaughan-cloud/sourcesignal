/**
 * UK Companies House — newly incorporated companies.
 *
 * Key-authenticated advanced search API. Requires:
 *   COMPANIES_HOUSE_API_KEY
 * https://api.companieshouse.gov.uk
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  clampLimit,
  fetchJson,
  pickString,
  truncate,
} from "./http";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalSector,
  SignalSourceAdapter,
} from "./types";

const DEFAULT_API_URL = "https://api.companieshouse.gov.uk";

function sectorFromSic(codes: string[]): SignalSector {
  const code = codes[0] ?? "";
  const prefix = code.slice(0, 2);

  if (["41", "42", "43"].includes(prefix)) return "CONSTRUCTION";
  if (prefix === "52") return "LOGISTICS";
  if (["49", "50", "51"].includes(prefix)) return "TRANSPORT";
  if (prefix === "35") return "ENERGY";
  if (["86", "87"].includes(prefix)) return "HEALTHCARE";
  if (["61", "62", "63"].includes(prefix)) return "TECH";
  if (["84", "85"].includes(prefix)) return "PUBLIC_SECTOR";
  return "TECH";
}

export class UkCompaniesHouseAdapter implements SignalSourceAdapter {
  readonly name = "uk-companies-house";
  readonly jurisdiction = "UK" as const;
  readonly enabled = Boolean(process.env.COMPANIES_HOUSE_API_KEY?.trim());

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
    if (!apiKey) return [];

    const since =
      options?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const url = new URL(
      `${process.env.COMPANIES_HOUSE_API_URL?.trim() || DEFAULT_API_URL}/advanced-search/companies`,
    );
    url.searchParams.set("incorporated_from", since.toISOString().slice(0, 10));
    url.searchParams.set(
      "incorporated_to",
      new Date().toISOString().slice(0, 10),
    );
    url.searchParams.set("company_status", "active");
    url.searchParams.set("size", String(clampLimit(options?.limit)));

    const data = await fetchJson<unknown>(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        Accept: "application/json",
      },
    });
    if (!data) return [];

    const items = asArray(asRecord(data).items);

    return items.flatMap((entry) => {
      const item = asRecord(entry);
      const companyNumber = pickString(item.company_number);
      const companyName = pickString(item.company_name, item.title);
      if (!companyNumber || !companyName) return [];

      const sicCodes = asArray(item.sic_codes).map(String);
      const sector = sectorFromSic(sicCodes);
      const sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`;
      const title = truncate(`New company incorporation: ${companyName}`, 240);

      return [
        {
          title,
          buyerName: companyName,
          jurisdiction: "UK" as const,
          sector,
          opportunityType: "EXPANSION" as const,
          estimatedValue: null,
          sourceName: "Companies House",
          sourceUrl,
          sourceId: companyNumber,
          commercialWhy: buildCommercialWhy({
            buyerName: companyName,
            sector,
            opportunityType: "EXPANSION",
            estimatedValue: null,
          }),
          publishedAt: pickString(item.date_of_creation, item.incorporated_on),
          rawPayload: { company: item, sicCodes },
        },
      ];
    });
  }
}

const ukCompaniesHouseAdapter = new UkCompaniesHouseAdapter();
export default ukCompaniesHouseAdapter;
