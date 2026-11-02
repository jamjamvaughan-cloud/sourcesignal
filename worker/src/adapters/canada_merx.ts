/**
 * Canada MERX source adapter.
 *
 * Discovers procurement opportunities from the CanadaBuys open tenders CSV
 * feed published on the Canadian Open Data Portal.
 *
 * Dataset: https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2
 * Resource: https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2/resource/719d3ed7-2681-4b13-9034-e8187889ff07/download/canada-buys-open-tenders.csv
 *
 * Configuration:
 *   CANADA_MERX_API_URL - Override for the CSV download URL
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const CANADA_MERX_API_URL =
  process.env.CANADA_MERX_API_URL ||
  "https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2/resource/719d3ed7-2681-4b13-9034-e8187889ff07/download/canada-buys-open-tenders.csv";

/**
 * Parses a CSV string into an array of objects keyed by the header row.
 * Handles quoted fields with embedded commas and newlines.
 */
function parseCsv(csvText: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === "\r") {
        // skip carriage return
      } else if (ch === "\n") {
        lines.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  if (current.trim()) {
    lines.push(current);
  }

  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields: string[] = [];
    let field = "";
    let inQuotes2 = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inQuotes2) {
        if (ch === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') {
            field += '"';
            j++;
          } else {
            inQuotes2 = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes2 = true;
        } else if (ch === ",") {
          fields.push(field.trim());
          field = "";
        } else {
          field += ch;
        }
      }
    }
    fields.push(field.trim());

    const record: Record<string, string> = {};
    for (let k = 0; k < header.length; k++) {
      record[header[k]] = fields[k] ?? "";
    }
    records.push(record);
  }

  return records;
}

export class CanadaMerxAdapter extends BaseSourceAdapter {
  readonly country = "CA" as const;

  constructor() {
    super("canada_merx", true);
  }

  async discover(): Promise<SourceRecord[]> {
    return this.fetchDeltas({
      publishedAfter: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  async fetchDeltas(params: { publishedAfter: string }): Promise<SourceRecord[]> {
    try {
      const resp = await fetch(CANADA_MERX_API_URL, {
        headers: {
          Accept: "text/csv, application/csv, */*",
          "User-Agent": "SourceSignal/1.0",
        },
      });

      if (!resp.ok) {
        console.error(
          `[worker] Canada MERX (CanadaBuys CSV) returned ${resp.status}`,
        );
        return [];
      }

      const csvText = await resp.text();
      const rows = parseCsv(csvText);
      const publishedAfterMs = new Date(params.publishedAfter).getTime();
      const records: SourceRecord[] = [];

      for (const row of rows) {
        const dateStr =
          row.published_date ?? row.publish_date ?? row.created_date ?? "";
        if (dateStr) {
          const recordDate = new Date(dateStr).getTime();
          if (recordDate < publishedAfterMs) {
            continue;
          }
        }

        const id =
          row.id ?? row.ocid ?? row.tender_id ?? row.reference_number ?? "";
        const region = String(row.region ?? row.province ?? "CA").toUpperCase();

        records.push({
          sourceId: String(id),
          sourceName: "canada_merx",
          country: "CA",
          sourceUrl: String(
            row.source_url ?? row.url ?? `https://buyandsell.gc.ca/notice/${id}`,
          ),
          rawPayload: { ...row, region },
          fetchedAt: new Date().toISOString(),
        });
      }

      return records;
    } catch (err) {
      console.error("[worker] Canada MERX adapter failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}

export default new CanadaMerxAdapter();
