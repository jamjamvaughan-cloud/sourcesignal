/**
 * SEC EDGAR — corporate filing signals for major federal contractors.
 *
 * Free, unauthenticated JSON submissions API, but SEC requires a descriptive
 * User-Agent identifying the caller.
 * https://data.sec.gov/submissions/CIK##########.json
 *
 * The watchlist is configurable with SEC_EDGAR_CIKS (comma-separated).
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  fetchJson,
  inferSector,
  pickString,
  toIsoDate,
  truncate,
} from "./http";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalOpportunityType,
  SignalSourceAdapter,
} from "./types";

const DEFAULT_CIKS = [
  "0000936468", // Lockheed Martin
  "0000101829", // RTX
  "0000012927", // Boeing
  "0000040533", // General Dynamics
  "0001133421", // Northrop Grumman
  "0001336920", // Leidos
  "0001443646", // Booz Allen Hamilton
  "0001321655", // Palantir
];

const MATERIAL_FORMS = new Set([
  "8-K",
  "10-K",
  "10-Q",
  "S-1",
  "S-3",
  "424B4",
  "424B5",
]);

function classificationForForm(form: string): SignalOpportunityType {
  if (/^(S-|424B)/.test(form) || form === "8-K") return "EXPANSION";
  return "COMPLIANCE";
}

function normaliseCik(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export class UsSecAdapter implements SignalSourceAdapter {
  readonly name = "us-sec";
  readonly jurisdiction = "US" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since =
      options?.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const watchlist = (
      process.env.SEC_EDGAR_CIKS?.split(",") ?? DEFAULT_CIKS
    )
      .map((value) => normaliseCik(value.trim()))
      .filter((value) => value.length === 10);

    const userAgent =
      process.env.SEC_EDGAR_USER_AGENT?.trim() ||
      "SourceSignal/1.0 (contact@sourcesignal.site)";

    const cap = Math.max(1, options?.limit ?? 100);
    const signals: NormalisedSignal[] = [];

    for (const cik of watchlist) {
      if (signals.length >= cap) break;

      const data = await fetchJson<unknown>(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        { headers: { "User-Agent": userAgent } },
      );
      if (!data) continue;

      const company = asRecord(data);
      const companyName =
        pickString(company.name, company.entityName) ?? `SEC registrant ${cik}`;
      const recent = asRecord(asRecord(company.filings).recent);

      const accessionNumbers = asArray(recent.accessionNumber);
      const filingDates = asArray(recent.filingDate);
      const forms = asArray(recent.form);
      const primaryDocuments = asArray(recent.primaryDocument);
      const descriptions = asArray(recent.primaryDocDescription);

      for (
        let index = 0;
        index < accessionNumbers.length && signals.length < cap;
        index++
      ) {
        const form = String(forms[index] ?? "");
        if (!MATERIAL_FORMS.has(form)) continue;

        const filingDate = toIsoDate(filingDates[index]);
        if (filingDate && new Date(filingDate) < since) continue;

        const accession = String(accessionNumbers[index] ?? "");
        if (!accession) continue;

        const accessionPath = accession.replace(/-/g, "");
        const cikPath = cik.replace(/^0+/, "") || "0";
        const primaryDocument = String(primaryDocuments[index] ?? "");
        const sourceUrl = primaryDocument
          ? `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}/${primaryDocument}`
          : `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}/`;

        const description = pickString(descriptions[index]) ?? "";
        const title = truncate(
          `${companyName}: ${form} filing${description ? ` — ${description}` : ""}`,
          240,
        );
        const opportunityType = classificationForForm(form);
        const text = `${title} ${companyName} ${form} ${description}`;
        const sector = inferSector(text, "TECH");

        signals.push({
          title,
          buyerName: companyName,
          jurisdiction: "US",
          sector,
          opportunityType,
          estimatedValue: null,
          sourceName: "SEC EDGAR",
          sourceUrl,
          sourceId: `${cik}-${accession}`,
          commercialWhy: buildCommercialWhy({
            buyerName: companyName,
            sector,
            opportunityType,
            estimatedValue: null,
          }),
          publishedAt: filingDate,
          rawPayload: {
            cik,
            companyName,
            accession,
            form,
            description,
          },
        });
      }
    }

    return signals;
  }
}

const usSecAdapter = new UsSecAdapter();
export default usSecAdapter;
