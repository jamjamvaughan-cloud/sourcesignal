/**
 * Signal scoring engine.
 *
 * Computes market velocity, signal tier, and attaches country/sector tags
 * to normalized opportunities during ingestion. Runs on every delta
 * ingestion cycle and on inbound webhook pushes.
 *
 * Uses dynamic exchange rates from src/lib/currency.ts for GBP conversion.
 */

import { createHash } from "crypto";
import type { CountryCode } from "@/types";
import type { SourceRecord } from "@/types";
import { SECTORS_BY_ID } from "@/lib/config/sectors";
import { convertToGBP } from "@/lib/currency";

export interface ScoredSignal {
  /** Canonical identifier (set during canonicalisation). */
  canonicalId: string;
  /** Opportunity title. */
  title: string;
  /** Short summary. */
  summary?: string;
  /** Buyer / issuing authority. */
  buyer?: string;
  /** Canonical buyer entity ID (e.g., "uk-mod", "us-dod"). */
  buyerCanonicalId?: string;
  /** Sector (core sub-industry id). */
  sector: string;
  /** Region code (country-specific). */
  region: string;
  /** Location (city, etc.). */
  location?: string;
  /** Latitude (optional, for map). */
  latitude?: number;
  /** Longitude (optional, for map). */
  longitude?: number;
  /** Publication date (ISO 8601). */
  publishedDate?: string;
  /** Closing date (ISO 8601). */
  closingDate?: string;
  /** Estimated value (numeric). */
  estimatedValue?: number;
  /** Currency code (GBP, USD, EUR, CAD, AUD). */
  currency?: string;
  /** Procurement stage. */
  procurementStage?: string;
  /** Source URL. */
  sourceUrl: string;
  /** Extraction confidence (0-100). */
  confidence?: number;
  /** Structured detail fields (key-value). */
  detailFields?: Record<string, unknown>;
  /** Commercial valuation tier. */
  signalTier: "STANDARD_COMMERCIAL" | "HIGH_CAP" | "MEGAPROCUREMENT";
  /** CPV code for provenance traceability. */
  cpvCode?: string;
  /** Market velocity score (0-100). */
  marketVelocity: number;
  /** Country tag for geographic isolation (UK, US, CA, IE, AU, EU). */
  countryTag: CountryCode;
  /** Sector slug for filtering. */
  sectorSlug: string;
  /** Intent classification. */
  intent: "high_value" | "standard" | "monitoring";
  /** When the signal was scored. */
  scoredAt: string;
  /** Displacement trigger / vulnerability angle for pitch context. */
  vulnerabilityTrigger?: string;
  /** SHA-256 hash of the source snapshot for proof-of-signal verification. */
  sourceHash?: string;
  /** Raw source snapshot (HTML/text) captured at ingestion time. */
  sourceSnapshot?: string;
}

/** Value thresholds for signal tier classification (in GBP). */
const VALUE_THRESHOLDS = {
  MEGAPROCUREMENT: 10_000_000, // £10M+
  HIGH_CAP: 1_000_000,         // £1M+
  STANDARD: 100_000,           // £100k+
} as const;

/**
 * Computes a market velocity score (0-100) based on estimated value
 * (already GBP-converted), publication recency, and sector competitiveness.
 */
function computeMarketVelocity({
  estimatedValue,
  publishedDate,
}: {
  estimatedValue: number;
  publishedDate: string;
}): number {
  let score = 50; // base score

  // Value-based boost.
  if (estimatedValue >= VALUE_THRESHOLDS.MEGAPROCUREMENT) score += 30;
  else if (estimatedValue >= VALUE_THRESHOLDS.HIGH_CAP) score += 20;
  else if (estimatedValue >= VALUE_THRESHOLDS.STANDARD) score += 10;

  // Recency boost: very recent publications score higher.
  const publishedMs = new Date(publishedDate).getTime();
  const ageMs = Date.now() - publishedMs;
  if (ageMs < 60_000) score += 20; // published within the last 60 seconds
  else if (ageMs < 300_000) score += 10; // within 5 minutes

  return Math.min(100, Math.max(0, score));
}

/**
 * Lightweight buyer canonical ID resolution for the enrichment layer.
 * Handles the most common public sector buyer name fragments.
 * The full resolution table lives in worker/src/lib/normalise-buyer.ts.
 */
function resolveBuyerCanonicalId(buyer: string | undefined): string | undefined {
  if (!buyer) return undefined;

  const normalized = buyer.toLowerCase().trim();

  const fragmentMap: Record<string, string> = {
    // UK Ministry of Defence
    "ministry of defence": "uk-mod",
    "mod uk": "uk-mod",
    "mod": "uk-mod",
    "de&s": "uk-mod",
    "defence equipment and support": "uk-mod",
    "defence equipment & support": "uk-mod",
    // US Department of Defense
    "department of defense": "us-dod",
    "department of defence": "us-dod",
    "dod": "us-dod",
    // US General Services Administration
    "general services administration": "us-gsa",
    "gsa": "us-gsa",
    // Canada PSPC
    "public services and procurement canada": "ca-pspc",
    "pspc": "ca-pspc",
    "canada buys": "ca-pspc",
    // Ireland OGP
    "office of government procurement": "ie-ogp",
    "ogp": "ie-ogp",
    // EU EDA
    "european defence agency": "eu-eda",
    "eda": "eu-eda",
  };

  // Exact match first.
  if (fragmentMap[normalized]) {
    return fragmentMap[normalized];
  }

  // Substring match (longest fragment wins).
  let bestMatch: string | undefined;
  let bestMatchLength = 0;
  for (const [fragment, canonicalId] of Object.entries(fragmentMap)) {
    if (normalized.includes(fragment) && fragment.length > bestMatchLength) {
      bestMatch = canonicalId;
      bestMatchLength = fragment.length;
    }
  }

  return bestMatch;
}

/**
 * Classifies intent based on market velocity score.
 */
function classifyIntent(velocity: number): ScoredSignal["intent"] {
  if (velocity >= 80) return "high_value";
  if (velocity >= 50) return "standard";
  return "monitoring";
}

/**
 * Auto-classifies the primary displacement trigger / vulnerability angle
 * for a signal based on title, sector, procurement stage, and raw payload
 * keywords. This gives subscribers instant pitch context before they open
 * the source link.
 */
function classifyVulnerabilityTrigger(
  title: string,
  sector: string,
  procurementStage?: string,
  rawPayload?: Record<string, unknown>,
): string | null {
  const text = `${title} ${sector} ${procurementStage ?? ""} ${JSON.stringify(rawPayload ?? {})}`.toLowerCase();

  // Legacy System EOL
  if (
    text.match(/legacy|end.of.life|eol|deprecat|outdated|obsolete|sunset|phase.?out|replacement|migration away|modernisation|modernization/)
  ) {
    return "Legacy System EOL";
  }

  // Vendor Price Surge
  if (
    text.match(/price surge|price hike|fee increase|cost increase|tariff|300%|200%|surge|spike|escalation|price.gouging/)
  ) {
    return "Vendor Price Surge";
  }

  // CAPEX Expansion
  if (
    text.match(/capex|capital.expenditure|expansion|build|construction|new facility|new site|greenfield|infrastructure project|digital transformation/)
  ) {
    return "CAPEX Expansion";
  }

  // Planning Approval Stage 2
  if (
    text.match(/planning|planning approval|stage 2|stage two|permit|planning permission|development control|s.106|section 106|condition discharge/)
  ) {
    return "Planning Approval Stage 2";
  }

  return null;
}

/**
 * Computes a SHA-256 hash of the source snapshot for proof-of-signal verification.
 */
function computeSourceHash(snapshot: string | null | undefined): string | null {
  if (!snapshot) return null;
  return createHash("sha256").update(snapshot).digest("hex");
}

/**
 * Normalises and scores a source record into a ScoredSignal.
 *
 * Uses dynamic exchange rates to convert estimated value to GBP before
 * computing signal tier and market velocity.
 *
 * @param record - Raw source record from an adapter.
 * @param country - Country/jurisdiction tag (UK, US, CA, IE, AU, EU).
 * @returns A fully scored and normalized signal.
 */
export async function computeSignalAndNormalize(
  record: SourceRecord,
  country: CountryCode,
): Promise<ScoredSignal> {
  const payload = record.rawPayload as Record<string, unknown>;

  const title = String(payload.title ?? record.sourceId);
  const sector = String(payload.sector ?? "").toLowerCase();
  // Validate sector against canonical 15 sector IDs; invalid sectors are
  // retained as-is but will not match any sector filter.
  const validSector = sector in SECTORS_BY_ID ? sector : "";
  const region = String(
    payload.region ?? record.rawPayload.region ?? "",
  ).toUpperCase();
  const estimatedValue = payload.estimatedValue
    ? Number(payload.estimatedValue)
    : 0;
  const currency = String(payload.currency ?? "GBP");
  // Convert to GBP using dynamic exchange rates for consistent threshold
  // comparison across currencies.
  const estimatedValueGBP = await convertToGBP(estimatedValue, currency);
  const publishedDate =
    String(payload.publishedDate ?? record.fetchedAt) || new Date().toISOString();

  const marketVelocity = computeMarketVelocity({
    estimatedValue: estimatedValueGBP,
    publishedDate,
  });

  // Determine signal tier from GBP-converted estimated value.
  let signalTier: ScoredSignal["signalTier"];
  if (estimatedValueGBP >= VALUE_THRESHOLDS.MEGAPROCUREMENT) {
    signalTier = "MEGAPROCUREMENT";
  } else if (estimatedValueGBP >= VALUE_THRESHOLDS.HIGH_CAP) {
    signalTier = "HIGH_CAP";
  } else {
    signalTier = "STANDARD_COMMERCIAL";
  }

  const intent = classifyIntent(marketVelocity);
  const vulnerabilityTrigger = classifyVulnerabilityTrigger(
    title,
    sector,
    payload.procurementStage ? String(payload.procurementStage) : undefined,
    payload,
  );
  const sourceSnapshot = payload.sourceSnapshot ? String(payload.sourceSnapshot) : undefined;
  const sourceHash = sourceSnapshot ? computeSourceHash(sourceSnapshot) : undefined;

  return {
    canonicalId: "", // set during canonicalisation
    title,
    summary: payload.summary ? String(payload.summary) : undefined,
    buyer: payload.buyer ? String(payload.buyer) : undefined,
    buyerCanonicalId: resolveBuyerCanonicalId(
      payload.buyer ? String(payload.buyer) : undefined,
    ),
    sector: validSector,
    region,
    location: payload.location ? String(payload.location) : undefined,
    latitude: payload.latitude ? Number(payload.latitude) : undefined,
    longitude: payload.longitude ? Number(payload.longitude) : undefined,
    publishedDate,
    closingDate: payload.closingDate ? String(payload.closingDate) : undefined,
    estimatedValue: estimatedValue || undefined,
    currency,
    procurementStage: payload.procurementStage
      ? String(payload.procurementStage)
      : undefined,
    sourceUrl: record.sourceUrl,
    sourceHash: sourceHash ?? undefined,
    confidence: payload.confidence ? Number(payload.confidence) : undefined,
    detailFields: payload.detailFields
      ? (payload.detailFields as Record<string, unknown>)
      : undefined,
    signalTier,
    cpvCode:
      typeof payload.cpv === "string"
        ? payload.cpv
        : typeof payload.cpv_code === "string"
          ? payload.cpv_code
          : undefined,
    // Signal scoring fields.
    marketVelocity,
    countryTag: country,
    sectorSlug: validSector,
    intent,
    vulnerabilityTrigger: vulnerabilityTrigger ?? undefined,
    sourceSnapshot,
    scoredAt: new Date().toISOString(),
  };
}
