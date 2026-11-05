/**
 * Shared types for the primary-source ingestion engine.
 *
 * Adapters return `NormalisedSignal` records. The runner computes the
 * SHA-256 source hash and persists rows into the PostgreSQL `signals` table.
 */

export const SIGNAL_JURISDICTIONS = ["UK", "US", "EU"] as const;
export type Jurisdiction = (typeof SIGNAL_JURISDICTIONS)[number];

export const SIGNAL_SECTORS = [
  "TECH",
  "ENERGY",
  "HEALTHCARE",
  "PUBLIC_SECTOR",
  "CONSTRUCTION",
  "TRANSPORT",
  "LOGISTICS",
] as const;
export type SignalSector = (typeof SIGNAL_SECTORS)[number];

export const SIGNAL_OPPORTUNITY_TYPES = [
  "PROJECT",
  "PROCUREMENT",
  "EXPANSION",
  "COMPLIANCE",
  "POLICY",
] as const;
export type SignalOpportunityType = (typeof SIGNAL_OPPORTUNITY_TYPES)[number];

/** A source record normalised into the unified signals schema. */
export interface NormalisedSignal {
  /** Headline or short description of the commercial signal. */
  title: string;
  /** Buying organisation, company, or public body. */
  buyerName: string;
  jurisdiction: Jurisdiction;
  sector: SignalSector;
  opportunityType: SignalOpportunityType;
  /** Estimated contract, award, or investment value where disclosed. */
  estimatedValue?: number | null;
  /** Human-readable source name, e.g. "GOV.UK Find a Tender". */
  sourceName: string;
  /** Canonical, publicly reachable source URL. */
  sourceUrl: string;
  /** Stable identifier within the source, used for deduplication. */
  sourceId?: string;
  /** Single-sentence commercial explanation of why the signal matters. */
  commercialWhy: string;
  /** Publication/capture date from the source, when available. */
  publishedAt?: string | null;
  /** Raw source payload retained for provenance/debugging. */
  rawPayload?: Record<string, unknown>;
}

/** Common interface implemented by every ingestion adapter. */
export interface SignalSourceAdapter {
  /** Stable machine name, e.g. "uk-tenders". */
  readonly name: string;
  readonly jurisdiction: Jurisdiction;
  /** Disabled adapters are skipped (e.g. missing API key). */
  readonly enabled: boolean;
  discover(options?: IngestionOptions): Promise<NormalisedSignal[]>;
}

export interface IngestionOptions {
  /** Only return records published/captured after this date. */
  since?: Date;
  /** Only return records published/captured before this date. */
  until?: Date;
  /** Maximum records to request per page from the source. */
  limit?: number;
  /**
   * Maximum pages to follow for adapters that support pagination. Defaults to
   * 1 so routine ingestion stays bounded; the historical backfill raises it.
   */
  maxPages?: number;
  /** Page number for paginated endpoints (used by the historical backfill). */
  page?: number;
}

export interface SignalIngestionResult {
  adapter: string;
  jurisdiction: Jurisdiction;
  status: "completed" | "failed" | "skipped";
  discovered: number;
  inserted: number;
  duplicates: number;
  failed: number;
  durationMs: number;
  error?: string;
}

export interface IngestionCycleResult {
  startedAt: string;
  finishedAt: string;
  adapters: SignalIngestionResult[];
  inserted: number;
  duplicates: number;
  failed: number;
}
