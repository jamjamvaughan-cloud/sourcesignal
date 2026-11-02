/**
 * SourceSignal ingestion worker — shared types.
 */

export interface SourceRecord {
  /** Stable identifier from the source system. */
  readonly sourceId: string;
  /** Source system name (e.g. "contracts-finder", "sam-gov"). */
  readonly sourceName: string;
  /** Country/jurisdiction this source belongs to (e.g. "UK", "US", "CA"). */
  readonly country?: string;
  /** Original source URL. */
  readonly sourceUrl: string;
  /** Raw source payload (preserved for provenance). */
  readonly rawPayload: Record<string, unknown>;
  /** When the record was fetched. */
  readonly fetchedAt: string;
}

export interface NormalisedOpportunity {
  /** Canonical identifier (generated during canonicalisation). */
  readonly canonicalId: string;
  /** Opportunity title. */
  readonly title: string;
  /** Short summary. */
  readonly summary?: string;
  /** Buyer / issuing authority. */
  readonly buyer?: string;
  /** Canonical buyer entity ID (e.g., "uk-mod", "us-dod"). */
  readonly buyerCanonicalId?: string;
  /** Sector (must match a supported sector id). */
  readonly sector: string;
  /** Region code (must match a supported region code). */
  readonly region: string;
  /** Location (city, country, etc.). */
  readonly location?: string;
  /** Latitude (optional, for map). */
  readonly latitude?: number;
  /** Longitude (optional, for map). */
  readonly longitude?: number;
  /** Publication date (ISO 8601). */
  readonly publishedDate?: string;
  /** Closing date (ISO 8601). */
  readonly closingDate?: string;
  /** Estimated value (numeric). */
  readonly estimatedValue?: number;
  /** Currency code (GBP, USD, EUR, CAD). */
  readonly currency?: string;
  /** Procurement stage. */
  readonly procurementStage?: string;
  /** Source URL. */
  readonly sourceUrl: string;
  /** SHA-256 hash of the source snapshot. */
  readonly sourceHash?: string;
  /** Extraction confidence (0-100). */
  readonly confidence?: number;
  /** Structured detail fields (key-value). */
  readonly detailFields?: Record<string, unknown>;
  /** Subcontractor entities extracted from tender text (winner forensics). */
  readonly subcontractors?: string[];
  /** Award winner / winning bidder entity. */
  readonly winningBidder?: string;
  /** Estimated contract expiry date (ISO 8601), derived from award date + duration. */
  readonly estimatedExpiryDate?: string;
  /** Incumbent / winning buyer entity. */
  readonly incumbentWinner?: string;
  /** Commercial valuation tier. */
  readonly signalTier?: "STANDARD_COMMERCIAL" | "HIGH_CAP" | "MEGAPROCUREMENT";
  /** CPV code for provenance traceability (extracted from raw payload). */
  readonly cpvCode?: string;
}

export interface ExtractionResult {
  /** Structured extracted fields. */
  readonly fields: Record<string, unknown>;
  /** Whether extraction succeeded. */
  readonly success: boolean;
  /** Confidence score (0-100). */
  readonly confidence: number;
  /** Status: success, partial, failed, skipped. */
  readonly status: "success" | "partial" | "failed" | "skipped";
  /** Error message if failed. */
  readonly error?: string;
  /** Model used for extraction. */
  readonly model?: string;
  /** Whether any values were inferred (not directly from source). */
  readonly inferred: boolean;
}

export interface IngestionRunStats {
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface SourceAdapter {
  /** Human-readable adapter name. */
  readonly name: string;
  /** Whether this adapter is enabled. */
  readonly enabled: boolean;
  /** Country/jurisdiction this source belongs to (e.g. "UK", "US", "CA"). */
  readonly country?: string;
  /** Discover records from the source. */
  discover(): Promise<SourceRecord[]>;
  /** Fetch delta records published/updated after a given timestamp. */
  fetchDeltas?(params: { publishedAfter: string }): Promise<SourceRecord[]>;
  /** Fetch and preserve source evidence for a record. */
  fetchEvidence?(record: SourceRecord): Promise<SourceRecord>;
}

/**
 * Ingestion pipeline result for a single run.
 */
export interface IngestionResult {
  readonly source: string;
  readonly status: "completed" | "failed" | "partial";
  readonly stats: IngestionRunStats;
  readonly errors: Array<{ source?: string; message: string; retryCount: number }>;
  readonly startedAt: string;
  readonly finishedAt: string;
}
