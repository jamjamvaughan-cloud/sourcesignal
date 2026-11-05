/**
 * Shared HTTP + normalisation helpers for ingestion adapters.
 *
 * Every helper is defensive: malformed upstream payloads should degrade to
 * `undefined`/empty arrays rather than throwing and aborting a whole cycle.
 */

const DEFAULT_TIMEOUT_MS = 20_000;

export const DEFAULT_USER_AGENT =
  process.env.INGESTION_USER_AGENT?.trim() ||
  "SourceSignal/1.0 (+https://sourcesignal.site; primary-source ingestion)";

/**
 * Fetches JSON with a timeout and a descriptive User-Agent. Returns null on a
 * non-2xx response or network/parse failure so adapters can return `[]`.
 */
export async function fetchJson<T>(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("User-Agent")) headers.set("User-Agent", DEFAULT_USER_AGENT);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(
        `[ingestion] ${String(input)} returned ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    console.warn(
      `[ingestion] ${String(input)} failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Low-level fetch that returns the status and parsed JSON (or null on network failure). */
interface FetchRawResult {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly data: unknown;
}

async function fetchRaw(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FetchRawResult | null> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("User-Agent")) headers.set("User-Agent", DEFAULT_USER_AGENT);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });

    let data: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { ok: response.ok, status: response.status, statusText: response.statusText, headers: response.headers, data };
  } catch (err) {
    console.warn(
      `[ingestion] ${String(input)} failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export interface FetchBackoffOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/** Sleeps for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches JSON with exponential backoff on HTTP 429/503/5xx responses.
 * Returns null on network failure or after exhausting retries.
 */
export async function fetchJsonWithBackoff<T>(
  input: string | URL,
  init: RequestInit = {},
  options: FetchBackoffOptions = {},
): Promise<T | null> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = 6,
    baseDelayMs = 500,
    maxDelayMs = 30_000,
  } = options;

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const raw = await fetchRaw(input, init, timeoutMs);
    if (!raw) return null; // network failure, do not retry
    if (raw.ok) return raw.data as T;

    const retryable =
      raw.status === 429 ||
      raw.status === 503 ||
      (raw.status >= 500 && raw.status < 600);
    if (!retryable || attempt > maxRetries) {
      console.warn(
        `[ingestion] ${String(input)} returned ${raw.status} ${raw.statusText} (no retry)`,
      );
      return null;
    }

    const retryAfter = raw.headers.get("retry-after");
    const headerDelay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : NaN;
    const exponential = Math.min(
      baseDelayMs * Math.pow(2, attempt - 1),
      maxDelayMs,
    );
    // Add jitter so concurrent clients don't retry in lockstep.
    const delay = Number.isFinite(headerDelay)
      ? headerDelay
      : exponential + Math.floor(Math.random() * 500);

    console.warn(
      `[ingestion] ${String(input)} returned ${raw.status}; retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
    );
    await sleep(delay);
  }

  return null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Returns the first non-empty string from the supplied values. */
export function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

/** Returns the first finite number from the supplied values. */
export function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

/** Parses values such as "£1,200,000", "1.2m", "500k", or 250000. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const match = value
    .replace(/,/g, "")
    .trim()
    .toLowerCase()
    .match(/(-?\d+(?:\.\d+)?)\s*(k|m|bn|b)?/);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = match[2];
  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;
  if (suffix === "b" || suffix === "bn") return base * 1_000_000_000;
  return base;
}

/** Converts a date-like value to an ISO string, or null when invalid. */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  // TED returns local dates as "YYYY-MM-DD+01:00", which `new Date()` rejects.
  if (typeof value === "string") {
    const tedDate = value.trim().match(/^(\d{4}-\d{2}-\d{2})\+(\d{2}:\d{2})$/);
    if (tedDate) {
      const date = new Date(`${tedDate[1]}T00:00:00+${tedDate[2]}`);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** True when `iso` is null/unknown, or falls within [since, until] inclusive. */
export function withinWindow(
  iso: string | null | undefined,
  since: Date,
  until: Date,
): boolean {
  if (!iso) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  return date >= since && date <= until;
}

export function clampLimit(
  value: number | undefined,
  fallback = 100,
  max = 100,
): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

export function truncate(value: string, max = 280): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

const SECTOR_KEYWORDS: Array<[SignalSector, RegExp]> = [
  [
    "HEALTHCARE",
    /\b(health|hospital|nhs|medical|medicine|pharma|clinical|care home|social care|diagnostic)\b/i,
  ],
  [
    "ENERGY",
    /\b(energy|solar|wind|grid|nuclear|hydrogen|battery|power|utility|utilities|oil|gas|decarbon|renewable)\b/i,
  ],
  [
    "TRANSPORT",
    /\b(transport|rail|railway|road|highway|bus|airport|port|transit|mobility|metro|tram)\b/i,
  ],
  [
    "LOGISTICS",
    /\b(logistics|warehouse|distribution|supply chain|freight|fleet|courier|fulfilment)\b/i,
  ],
  [
    "CONSTRUCTION",
    /\b(construction|construct|build|planning|permit|housing|infrastructure|civil|refurbish|fit-out|demolition)\b/i,
  ],
  [
    "PUBLIC_SECTOR",
    /\b(public sector|government|council|municipal|defence|defense|police|education|framework|procurement|authority)\b/i,
  ],
  [
    "TECH",
    /\b(digital|software|cloud|cyber|data|artificial intelligence|\bai\b|technology|network|platform|saas|ict|computing)\b/i,
  ],
];

import type { SignalSector, SignalOpportunityType } from "./types";

/** Best-effort sector classification from title, buyer, and raw text. */
export function inferSector(text: string, fallback: SignalSector = "PUBLIC_SECTOR"): SignalSector {
  for (const [sector, pattern] of SECTOR_KEYWORDS) {
    if (pattern.test(text)) return sector;
  }
  return fallback;
}

/** Best-effort opportunity type classification from descriptive text. */
export function inferOpportunityType(
  text: string,
  fallback: SignalOpportunityType = "PROCUREMENT",
): SignalOpportunityType {
  if (/\b(compliance|regulat|mandate|audit|sanction|obligation|reporting)\b/i.test(text)) {
    return "COMPLIANCE";
  }
  if (/\b(policy|strategy|programme|program|funding|grant|subsid|initiative|roadmap)\b/i.test(text)) {
    return "POLICY";
  }
  if (/\b(expansion|expand|greenfield|new facility|new site|capex|investment|acquisition|merger|scale[- ]?up)\b/i.test(text)) {
    return "EXPANSION";
  }
  if (/\b(project|planning|construction|build|infrastructure|development|refurbish|upgrade)\b/i.test(text)) {
    return "PROJECT";
  }
  return fallback;
}

const SECTOR_LABELS: Record<SignalSector, string> = {
  TECH: "technology",
  ENERGY: "energy",
  HEALTHCARE: "healthcare",
  PUBLIC_SECTOR: "public-sector",
  CONSTRUCTION: "construction",
  TRANSPORT: "transport",
  LOGISTICS: "logistics",
};

function compactValue(value: number): string {
  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

/**
 * Produces a single-sentence commercial explanation. Buyer names are stripped
 * of trailing punctuation so the result never reads as multiple sentences.
 */
export function buildCommercialWhy(input: {
  buyerName: string;
  sector: SignalSector;
  opportunityType: SignalOpportunityType;
  estimatedValue?: number | null;
}): string {
  const buyer = input.buyerName.replace(/[.\s]+$/, "") || "This buyer";
  const sector = SECTOR_LABELS[input.sector];
  const value =
    input.estimatedValue && input.estimatedValue > 0
      ? ` with an estimated value of ${compactValue(input.estimatedValue)}`
      : "";

  switch (input.opportunityType) {
    case "PROJECT":
      return `${buyer} has advanced a ${sector} project${value}, creating near-term delivery and subcontracting demand.`;
    case "EXPANSION":
      return `${buyer} is expanding ${sector} operations${value}, signalling new capex and supplier requirements.`;
    case "COMPLIANCE":
      return `${buyer} faces a ${sector} compliance milestone${value}, creating demand for remediation and assurance work.`;
    case "POLICY":
      return `${buyer} has issued a ${sector} policy signal${value}, pointing to funded programmes and upcoming procurement.`;
    case "PROCUREMENT":
    default:
      return `${buyer} has released a ${sector} procurement${value}, opening a verified window for supplier engagement.`;
  }
}

/** Resolves a possibly localised object/array value from EU-style payloads. */
export function localisedText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = localisedText(entry);
      if (text) return text;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of [
      "en",
      "eng",
      "value",
      "text",
      "label",
      "title",
      "name",
    ]) {
      const text = localisedText(record[key]);
      if (text) return text;
    }
    // TED and EU Open Data localise titles under arbitrary language codes
    // (e.g. "ron", "hun", "deu"). Fall back to the first usable value.
    for (const entry of Object.values(record)) {
      const text = localisedText(entry);
      if (text) return text;
    }
  }
  return undefined;
}
