/**
 * SEC EDGAR — corporate filing signals for major federal contractors.
 *
 * Free, unauthenticated JSON submissions API. SEC requires a descriptive
 * User-Agent identifying the caller.
 *
 * Historical backfill reads `filings.recent` (most recent ~1,000 filings) and
 * any legacy `filings.files` whose date range overlaps the requested window,
 * fetching each legacy file with a polite delay between requests.
 * https://data.sec.gov/submissions/CIK##########.json
 */

import {
  asArray,
  asRecord,
  buildCommercialWhy,
  fetchJsonWithBackoff,
  inferSector,
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

const MATERIAL_FORMS = new Set(["8-K", "10-K", "10-Q"]);

const PAGE_DELAY_MS = 500;

function classificationForForm(form: string): SignalOpportunityType {
  if (form === "8-K") return "EXPANSION";
  return "COMPLIANCE";
}

function normaliseCik(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

function cikPath(cik: string): string {
  return cik.replace(/^0+/, "") || "0";
}

/** Normalises a single filing from parallel SEC arrays. */
function normaliseFiling(
  cik: string,
  companyName: string,
  index: number,
  fields: {
    accessionNumber: unknown[];
    filingDate: unknown[];
    form: unknown[];
    primaryDocument: unknown[];
    primaryDocDescription: unknown[];
  },
): NormalisedSignal | null {
  const accession = String(fields.accessionNumber[index] ?? "");
  const filingDate = toIsoDate(fields.filingDate[index]);
  const form = String(fields.form[index] ?? "");
  if (!MATERIAL_FORMS.has(form) || !accession) return null;

  const accessionPath = accession.replace(/-/g, "");
  const primaryDocument = String(fields.primaryDocument[index] ?? "");
  const sourceUrl = primaryDocument
    ? `https://www.sec.gov/Archives/edgar/data/${cikPath(cik)}/${accessionPath}/${primaryDocument}`
    : `https://www.sec.gov/Archives/edgar/data/${cikPath(cik)}/${accessionPath}/`;

  const description = pickString(fields.primaryDocDescription[index]) ?? "";
  const title = truncate(
    `${companyName}: ${form} filing${description ? ` — ${description}` : ""}`,
    240,
  );
  const text = `${title} ${companyName} ${form} ${description}`;
  const sector = inferSector(text, "TECH");

  return {
    title,
    buyerName: companyName,
    jurisdiction: "US" as const,
    sector,
    opportunityType: classificationForForm(form),
    estimatedValue: null,
    sourceName: "SEC EDGAR",
    sourceUrl,
    sourceId: `${cik}-${accession}`,
    commercialWhy: buildCommercialWhy({
      buyerName: companyName,
      sector,
      opportunityType: classificationForForm(form),
      estimatedValue: null,
    }),
    publishedAt: filingDate,
    rawPayload: { cik, companyName, accession, form, description },
  };
}

export class UsSecAdapter implements SignalSourceAdapter {
  readonly name = "us-sec";
  readonly jurisdiction = "US" as const;
  readonly enabled = true;

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const since = options?.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const until = options?.until ?? new Date();
    const watchlist = (
      process.env.SEC_EDGAR_CIKS?.split(",") ?? DEFAULT_CIKS
    )
      .map((value) => normaliseCik(value.trim()))
      .filter((value) => value.length === 10);

    const userAgent =
      process.env.SEC_EDGAR_USER_AGENT?.trim() ||
      "SourceSignal/1.0 (contact@sourcesignal.site)";

    const signals: NormalisedSignal[] = [];

    for (const cik of watchlist) {
      const data = await fetchJsonWithBackoff<unknown>(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        { headers: { "User-Agent": userAgent } },
      );
      if (!data) continue;

      const root = asRecord(data);
      const companyName =
        pickString(root.name, root.entityName) ?? `SEC registrant ${cik}`;
      const filings = asRecord(root.filings);
      const recent = asRecord(filings.recent);

      // Most recent filings.
      signals.push(
        ...this.parseSecArrays(cik, companyName, recent, since, until),
      );

      // Legacy historical submission files overlapping the window.
      const files = asArray(filings.files);
      for (const file of files) {
        const fileRecord = asRecord(file);
        const filingTo = toIsoDate(pickString(fileRecord.filingTo));
        // Skip files that end before the window starts.
        if (filingTo && new Date(filingTo) < since) continue;
        const fileName = pickString(fileRecord.name);
        if (!fileName) continue;

        const fileData = await fetchJsonWithBackoff<unknown>(
          `https://data.sec.gov/submissions/${fileName}`,
          { headers: { "User-Agent": userAgent } },
        );
        if (!fileData) continue;

        const fileRoot = asRecord(fileData);
        signals.push(
          ...this.parseSecArrays(cik, companyName, fileRoot, since, until),
        );

        // Polite delay between SEC requests.
        await sleep(PAGE_DELAY_MS);
      }
    }

    return signals;
  }

  /** Parses filings within [since, until] from parallel SEC arrays. */
  private parseSecArrays(
    cik: string,
    companyName: string,
    root: Record<string, unknown>,
    since: Date,
    until: Date,
  ): NormalisedSignal[] {
    const fields = {
      accessionNumber: asArray(root.accessionNumber),
      filingDate: asArray(root.filingDate),
      form: asArray(root.form),
      primaryDocument: asArray(root.primaryDocument),
      primaryDocDescription: asArray(root.primaryDocDescription),
    };

    const signals: NormalisedSignal[] = [];
    const count = fields.accessionNumber.length;
    for (let index = 0; index < count; index++) {
      const filingDate = toIsoDate(fields.filingDate[index]);
      if (filingDate && !withinWindow(filingDate, since, until)) continue;

      const signal = normaliseFiling(cik, companyName, index, fields);
      if (signal) signals.push(signal);
    }
    return signals;
  }
}

const usSecAdapter = new UsSecAdapter();
export default usSecAdapter;
