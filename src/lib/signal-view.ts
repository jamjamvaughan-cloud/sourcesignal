/**
 * Presentation helpers for the dashboard signal feed.
 *
 * Pure, client-safe functions that turn a raw opportunity record into the
 * values shown on a Tesla-style signal card or in the provenance drawer.
 */

import { TAXONOMY } from "@/lib/taxonomy";

export interface SignalRecord {
  id: string;
  canonical_id: string;
  title: string;
  buyer?: string | null;
  sector: string;
  region: string;
  country?: string | null;
  location?: string | null;
  estimated_value?: number | null;
  est_deal_value?: number | null;
  currency?: string | null;
  procurement_stage?: string | null;
  published_date?: string | null;
  closing_date?: string | null;
  confidence?: number | null;
  signal_tier?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  source_captured_at?: string | null;
  source_hash?: string | null;
  sha256_hash?: string | null;
  summary?: string | null;
  is_demonstration?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  vulnerability_trigger?: string | null;
  winner?: string | null;
  opportunity_type?: string | null;
  opportunity_score?: number | null;
  commercial_why?: string | null;
  supplier_capabilities?: string[] | null;
  sub_category?: string | null;
}

export interface RegionMeta {
  lat: number;
  lon: number;
  label: string;
  short: string;
}

export const REGION_META: Record<string, RegionMeta> = {
  ENG: { lat: 52.6, lon: -1.5, label: "England", short: "ENG" },
  SCT: { lat: 56.8, lon: -4.2, label: "Scotland", short: "SCT" },
  WLS: { lat: 52.3, lon: -3.8, label: "Wales", short: "WLS" },
  NIR: { lat: 54.6, lon: -6.7, label: "Northern Ireland", short: "NIR" },
  IE: { lat: 53.4, lon: -8.2, label: "Ireland", short: "IE" },
  UK: { lat: 54.0, lon: -2.0, label: "United Kingdom", short: "UK" },
  US: { lat: 39.8, lon: -98.6, label: "United States", short: "US" },
  CA: { lat: 56.1, lon: -106.3, label: "Canada", short: "CA" },
  AU: { lat: -25.3, lon: 133.8, label: "Australia", short: "AU" },
  EU: { lat: 50.1, lon: 10.5, label: "Europe", short: "EU" },
};

export function regionMeta(region?: string | null): RegionMeta {
  const key = (region ?? "").trim().toUpperCase();
  return REGION_META[key] ?? {
    lat: 50.1,
    lon: 10.5,
    label: region?.trim() || "Unmapped",
    short: region?.trim() || "—",
  };
}

export function regionLabel(region?: string | null): string {
  return regionMeta(region).label;
}

export function sectorLabel(sector?: string | null): string {
  if (!sector) return "Unclassified";
  const match = TAXONOMY.find((item) => item.id === sector);
  if (match) return match.label;
  return sector
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function opportunityTypeLabel(type?: string | null): string {
  if (!type) return "Commercial signal";
  return type.replace(/_/g, " ").toLowerCase();
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  AUD: "A$",
  CAD: "C$",
  NZD: "NZ$",
};

/** Compact human-readable spend, e.g. £12.4M. Never invents a value. */
export function formatSpend(
  value?: number | null,
  currency?: string | null,
): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "UNDISCLOSED";

  const symbol =
    CURRENCY_SYMBOLS[(currency ?? "GBP").toUpperCase()] ??
    `${(currency ?? "GBP").toUpperCase()} `;
  const abs = Math.abs(numeric);
  const trim = (input: number) => input.toFixed(1).replace(/\.0$/, "");

  if (abs >= 1_000_000_000) return `${symbol}${trim(numeric / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${symbol}${trim(numeric / 1_000_000)}M`;
  if (abs >= 1_000) return `${symbol}${Math.round(numeric / 1_000)}K`;
  return `${symbol}${Math.round(numeric)}`;
}

/** The primary card metric: stored score, confidence, then tier fallback. */
export function signalScore(opportunity: SignalRecord): number {
  const raw = opportunity.opportunity_score ?? opportunity.confidence;
  const numeric = Number(raw);
  if (raw != null && Number.isFinite(numeric)) {
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }
  switch ((opportunity.signal_tier ?? "").toUpperCase()) {
    case "MEGAPROCUREMENT":
      return 94;
    case "HIGH_CAP":
      return 86;
    case "STANDARD_COMMERCIAL":
      return 76;
    default:
      return 64;
  }
}

export function estimatedSpend(opportunity: SignalRecord): number | null {
  const value = opportunity.estimated_value ?? opportunity.est_deal_value;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function firstSentence(text: string, max = 190): string {
  const normalised = text.replace(/\s+/g, " ").trim();
  if (!normalised) return "";
  const match = normalised.match(/^.{20,}?[.!?](?:\s|$)/);
  const sentence = match ? match[0] : normalised;
  return sentence.length > max
    ? `${sentence.slice(0, max - 1).trimEnd()}…`
    : sentence;
}

/** Single-sentence "Commercial Why" box on every card. */
export function commercialWhy(opportunity: SignalRecord): string {
  const stored = opportunity.commercial_why?.trim();
  if (stored) return firstSentence(stored);

  if (opportunity.summary?.trim()) {
    return firstSentence(opportunity.summary);
  }

  const buyer = opportunity.buyer?.trim() || "This buyer";
  const stage = (opportunity.procurement_stage ?? "active")
    .replace(/[-_]/g, " ")
    .toLowerCase();
  return `${buyer} has entered an ${stage} procurement window in ${sectorLabel(
    opportunity.sector,
  ).toLowerCase()}. Engage before the formal notice closes.`;
}

/** Capability badges shown at the foot of each card. */
export function capabilityBadges(opportunity: SignalRecord): string[] {
  const stored = (opportunity.supplier_capabilities ?? [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (stored.length > 0) return unique(stored).slice(0, 4);

  const derived: string[] = [];
  const sector = TAXONOMY.find((item) => item.id === opportunity.sector);
  const subCategory = sector?.subCategories.find(
    (item) => item.id === opportunity.sub_category,
  );
  if (subCategory) derived.push(subCategory.label);
  if (opportunity.opportunity_type) {
    derived.push(opportunity.opportunity_type.replace(/_/g, " "));
  }
  derived.push(sector?.label ?? "Sector capability");
  if (opportunity.region) derived.push(`Delivery · ${regionLabel(opportunity.region)}`);

  return unique(derived).slice(0, 4);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

export function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export type TimelineState = "complete" | "active" | "upcoming";

export interface TimelineEntry {
  label: string;
  value: string;
  note?: string;
  state: TimelineState;
}

/** Contract / incumbent timeline shown in the slide-over drawer. */
export function buildTimeline(opportunity: SignalRecord): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (opportunity.published_date) {
    entries.push({
      label: "Notice published",
      value: formatDate(opportunity.published_date),
      state: "complete",
    });
  }

  if (opportunity.source_captured_at || opportunity.created_at) {
    entries.push({
      label: "Source captured",
      value: formatDate(
        opportunity.source_captured_at ?? opportunity.created_at,
      ),
      note: opportunity.source_name ?? "Primary source",
      state: "complete",
    });
  }

  if (opportunity.procurement_stage) {
    entries.push({
      label: "Current stage",
      value: opportunity.procurement_stage.replace(/[-_]/g, " ").toUpperCase(),
      state: "active",
    });
  }

  if (opportunity.closing_date) {
    const remaining = daysUntil(opportunity.closing_date);
    entries.push({
      label: "Closing window",
      value: formatDate(opportunity.closing_date),
      note:
        remaining == null
          ? undefined
          : remaining >= 0
            ? `${remaining} days remaining`
            : `Closed ${Math.abs(remaining)} days ago`,
      state: remaining != null && remaining < 0 ? "complete" : "upcoming",
    });
  }

  return entries;
}
