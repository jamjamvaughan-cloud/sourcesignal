/**
 * Supported regions.
 *
 * Central, reusable configuration of the region codes SourceSignal uses to
 * scope procurement opportunities. The list is intentionally fixed.
 */

export const REGIONS = [
  "US",
  "CA",
  "ENG",
  "SCT",
  "WLS",
  "NIR",
  "IE",
  "AU",
  "EU",
] as const;

/** Region code union type, derived from the region list. */
export type Region = (typeof REGIONS)[number];

export function isValidRegion(value: string): value is Region {
  return REGIONS.includes(value as Region);
}
