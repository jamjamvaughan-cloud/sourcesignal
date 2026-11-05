/**
 * Shared TypeScript types used across the SourceSignal application.
 */

export type { Plan } from "@/lib/config";
export type { SectorId } from "@/lib/config";
import type { SectorId } from "@/lib/config";
export type { Region } from "@/lib/config";

/** Supported jurisdictions for multi-country coverage. */
export type CountryCode = "UK" | "US" | "CA" | "IE" | "AU" | "EU";

/** A raw source record from a procurement source adapter. */
export interface SourceRecord {
  /** Stable identifier from the source system. */
  readonly sourceId: string;
  /** Source system name (e.g. "contracts-finder", "sam-gov"). */
  readonly sourceName: string;
  /** Country/jurisdiction this source belongs to (e.g. "UK", "US", "CA"). */
  readonly country?: CountryCode;
  /** Original source URL. */
  readonly sourceUrl: string;
  /** Raw source payload (preserved for provenance). */
  readonly rawPayload: Record<string, unknown>;
  /** When the record was fetched. */
  readonly fetchedAt: string;
}

export const COUNTRIES: Array<{ code: CountryCode; label: string }> = [
  { code: "UK", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "IE", label: "Ireland" },
  { code: "AU", label: "Australia" },
  { code: "EU", label: "European Union" },
];

/** A nullable, server-side database client (may be absent in dev/dev mode). */
export type DbClient = import("@/lib/db").PoolClient | null;

/** User profile with preferred industries and country. */
export interface UserProfile {
  id: string;
  email: string;
  preferred_industries: SectorId[];
  country: CountryCode;
  plan: "free" | "pro";
}
