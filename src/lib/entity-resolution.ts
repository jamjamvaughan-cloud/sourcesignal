/**
 * Multi-Source Entity Resolution Service.
 *
 * Clusters related signals (planning permit + job posting + company filing)
 * under a single Unified Commercial Target Profile with an aggregated deal
 * value. Implements de-duplication across ingestion sources so a single
 * project mentioned in 5 places produces ONE signal, not five.
 *
 * Matching strategy (tiered):
 *   1. Exact canonical_id match (highest confidence)
 *   2. Buyer canonical_id match (e.g., "uk-mod")
 *   3. Normalised buyer name + country match (fuzzy)
 *   4. Source hash cluster (same raw_payload fingerprint)
 *
 * All matching is server-side. No client-side data silos.
 */

import { query } from "@/lib/db";
import type { CountryCode } from "@/types";

export interface EntityProfile {
  id: string;
  canonical_name: string;
  slug: string;
  sector?: string | null;
  region?: string | null;
  country?: string | null;
  aggregated_deal_value: number;
  signal_count: number;
  highest_tier: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface EntityMatchResult {
  profile: EntityProfile | null;
  isNew: boolean;
  matchReason: string | null;
  matchConfidence: number;
}

/**
 * Normalise a buyer/organisation name for entity matching.
 * Strips common legal suffixes, lowercases, collapses whitespace.
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.\-&/\\]/g, " ")
    .replace(/\b(ltd|limited|plc|inc|incorporated|corp|corporation|llc|llp|gmbh|ag|sa|nv|ab|oy|as|bv|spa|sarl|sas|pte|sdn|bhd|co|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a deterministic slug from a canonical name.
 */
function slugify(name: string): string {
  return normaliseName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/**
 * Resolve or create an entity profile for a given signal.
 *
 * Matching tiers:
 *   1. Exact canonical_id (buyer_canonical_id) match → confidence 1.0
 *   2. Normalised buyer name + country match → confidence 0.85
 *   3. No match → create new profile → confidence 0.0 (isNew)
 *
 * @param signal - Scored signal from the ingestion pipeline.
 * @returns EntityMatchResult with the resolved profile.
 */
export async function resolveOrCreateEntity(signal: {
  canonical_id: string;
  buyer?: string | null;
  buyer_canonical_id?: string | null;
  estimated_value?: number | null;
  currency?: string | null;
  sector?: string | null;
  region?: string | null;
  country?: CountryCode | null;
  source_name?: string | null;
  source_url?: string | null;
  signal_tier?: string | null;
  source_hash?: string | null;
}): Promise<EntityMatchResult> {
  const buyerName = signal.buyer ?? null;
  const buyerCanonicalId = signal.buyer_canonical_id ?? null;
  const country = signal.country ?? "UK";

  // --- Tier 1: Exact canonical_id match ---
  if (buyerCanonicalId) {
    const existing = await query(
      `SELECT id, canonical_name, slug, sector, region, country,
              aggregated_deal_value, signal_count, highest_tier,
              first_seen_at, last_seen_at
         FROM entity_profiles
        WHERE canonical_name ILIKE $1
          AND country = $2
        LIMIT 1`,
      [buyerCanonicalId, country],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return updateProfile(existing.rows[0], signal, "buyer_canonical_id", 1.0);
    }
  }

  // --- Tier 2: Normalised buyer name + country match ---
  if (buyerName) {
    const normalised = normaliseName(buyerName);
    if (normalised) {
      const existing = await query(
        `SELECT id, canonical_name, slug, sector, region, country,
                aggregated_deal_value, signal_count, highest_tier,
                first_seen_at, last_seen_at
           FROM entity_profiles
          WHERE LOWER(canonical_name) = $1
            AND country = $2
          LIMIT 1`,
        [normalised, country],
      );
      if ((existing.rowCount ?? 0) > 0) {
        return updateProfile(existing.rows[0], signal, "normalised_name", 0.85);
      }
    }
  }

  // --- Tier 3: No match — create new entity profile ---
  return createProfile(signal);
}

/**
 * Row shape returned by entity_profiles SELECT queries.
 */
interface EntityProfileRow {
  id: string;
  canonical_name: string;
  slug: string;
  sector?: string | null;
  region?: string | null;
  country?: string | null;
  aggregated_deal_value?: number | null;
  signal_count?: number | null;
  highest_tier?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
}

/**
 * Row shape returned by entity_profile_members SELECT queries.
 */
interface EntityProfileMemberRow {
  id: string;
  opportunity_id: string;
  match_reason?: string | null;
  match_confidence?: number | null;
  created_at?: string | null;
}

/**
 * Update an existing entity profile with a new signal member.
 */
async function updateProfile(
  row: EntityProfileRow,
  signal: {
    canonical_id?: string | null;
    estimated_value?: number | null;
    currency?: string | null;
    sector?: string | null;
    region?: string | null;
    signal_tier?: string | null;
  },
  matchReason: string,
  matchConfidence: number,
): Promise<EntityMatchResult> {
  const profileId = row.id;
  const existingValue = Number(row.aggregated_deal_value ?? 0);
  const existingCount = Number(row.signal_count ?? 0);
  const signalValue = Number(signal.estimated_value ?? 0);
  const newValue = existingValue + signalValue;
  const newCount = existingCount + 1;

  // Determine highest tier.
  const tierRank: Record<string, number> = {
    STANDARD_COMMERCIAL: 1,
    HIGH_CAP: 2,
    MEGAPROCUREMENT: 3,
  };
  const existingTierRank = tierRank[row.highest_tier ?? "STANDARD_COMMERCIAL"] ?? 1;
  const newTierRank = tierRank[signal.signal_tier ?? "STANDARD_COMMERCIAL"] ?? 1;
  const highestTier =
    newTierRank > existingTierRank
      ? (signal.signal_tier ?? "STANDARD_COMMERCIAL")
      : (row.highest_tier ?? "STANDARD_COMMERCIAL");

  await query(
    `UPDATE entity_profiles
          SET aggregated_deal_value = $1,
              signal_count = $2,
              highest_tier = $3,
              sector = COALESCE($4, sector),
              region = COALESCE($5, region),
              last_seen_at = NOW(),
              updated_at = NOW()
        WHERE id = $6`,
    [newValue, newCount, highestTier, signal.sector ?? null, signal.region ?? null, profileId],
  );

  // Link the opportunity as a member (idempotent).
  if (signal.canonical_id) {
    await query(
      `INSERT INTO entity_profile_members (entity_profile_id, opportunity_id, match_reason, match_confidence, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
      [profileId, signal.canonical_id, matchReason, matchConfidence],
    );
  }

  const profile: EntityProfile = {
    id: profileId,
    canonical_name: row.canonical_name,
    slug: row.slug,
    sector: row.sector ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    aggregated_deal_value: newValue,
    signal_count: newCount,
    highest_tier: highestTier,
    first_seen_at: row.first_seen_at ?? new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  return { profile, isNew: false, matchReason, matchConfidence };
}

/**
 * Create a new entity profile for a previously unseen buyer/organisation.
 */
async function createProfile(signal: {
  canonical_id: string;
  buyer?: string | null;
  buyer_canonical_id?: string | null;
  estimated_value?: number | null;
  currency?: string | null;
  sector?: string | null;
  region?: string | null;
  country?: CountryCode | null;
  signal_tier?: string | null;
}): Promise<EntityMatchResult> {
  const buyerName = signal.buyer ?? "Unknown Entity";
  const canonicalName = signal.buyer_canonical_id ?? buyerName;
  const slugBase = slugify(canonicalName);
  let slug = slugBase;

  // Ensure slug uniqueness.
  let attempt = 0;
  while (attempt < 10) {
    const existing = await query(
      `SELECT id FROM entity_profiles WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if (existing.rowCount === 0) break;
    attempt++;
    slug = `${slugBase}-${attempt}`;
  }

  const estimatedValue = Number(signal.estimated_value ?? 0);

  const result = await query(
    `INSERT INTO entity_profiles (
          canonical_name, slug, sector, region, country,
          aggregated_deal_value, signal_count, highest_tier,
          first_seen_at, last_seen_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW(), NOW())
        RETURNING id, canonical_name, slug, sector, region, country,
                  aggregated_deal_value, signal_count, highest_tier,
                  first_seen_at, last_seen_at`,
    [
      canonicalName,
      slug,
      signal.sector ?? null,
      signal.region ?? null,
      signal.country ?? "UK",
      estimatedValue,
      1,
      signal.signal_tier ?? "STANDARD_COMMERCIAL",
    ],
  );

  const row = result.rows[0];

  // Link the opportunity as a member.
  if (signal.canonical_id) {
    await query(
      `INSERT INTO entity_profile_members (entity_profile_id, opportunity_id, match_reason, match_confidence, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
      [row.id, signal.canonical_id, "new_entity", 1.0],
    );
  }

  const profile: EntityProfile = {
    id: row.id,
    canonical_name: row.canonical_name,
    slug: row.slug,
    sector: row.sector ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    aggregated_deal_value: row.aggregated_deal_value,
    signal_count: row.signal_count,
    highest_tier: row.highest_tier,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
  };

  return { profile, isNew: true, matchReason: "new_entity", matchConfidence: 1.0 };
}

/**
 * Fetch all entity profiles for an organisation, ordered by aggregated deal value.
 */
export async function listEntityProfiles(
  organisationId: string,
): Promise<EntityProfile[]> {
  const result = await query(
    `SELECT id, canonical_name, slug, sector, region, country,
            aggregated_deal_value, signal_count, highest_tier,
            first_seen_at, last_seen_at
       FROM entity_profiles
      WHERE organisation_id = $1
      ORDER BY aggregated_deal_value DESC, last_seen_at DESC`,
    [organisationId],
  );
  return result.rows.map((row: EntityProfileRow) => ({
    id: row.id,
    canonical_name: row.canonical_name,
    slug: row.slug,
    sector: row.sector ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    aggregated_deal_value: row.aggregated_deal_value ?? 0,
    signal_count: row.signal_count ?? 0,
    highest_tier: row.highest_tier ?? "STANDARD_COMMERCIAL",
    first_seen_at: row.first_seen_at ?? new Date().toISOString(),
    last_seen_at: row.last_seen_at ?? new Date().toISOString(),
  }));
}

/**
 * Fetch members (linked opportunities) for an entity profile.
 */
export async function getEntityProfileMembers(
  entityProfileId: string,
): Promise<Array<{
  id: string;
  opportunity_id: string;
  match_reason: string | null;
  match_confidence: number;
  created_at: string;
}>> {
  const result = await query(
    `SELECT id, opportunity_id, match_reason, match_confidence, created_at
       FROM entity_profile_members
      WHERE entity_profile_id = $1
      ORDER BY created_at DESC`,
    [entityProfileId],
  );
  return result.rows.map((row: EntityProfileMemberRow) => ({
    id: row.id,
    opportunity_id: row.opportunity_id,
    match_reason: row.match_reason ?? null,
    match_confidence: row.match_confidence ?? 1.0,
    created_at: row.created_at ?? new Date().toISOString(),
  }));
}

/**
 * Match a signal against active signal rules.
 * Creates signal_rule_matches for any matches and updates rule counters.
 *
 * Matching criteria:
 *   - Keywords: signal title/summary/buyer contains any keyword (case-insensitive)
 *   - Territories: signal country is in the rule's territory list
 *   - Min/Max value: signal estimated_value (GBP) is within range
 *   - Min tier: signal tier >= rule's min_tier
 *   - Vulnerability triggers: signal's trigger is in rule's list (or rule has none)
 *
 * @param organisationId - Optional organisation filter. If omitted, matches
 *   against all active rules across all organisations.
 * @param opportunityId - The opportunity id to link matches to.
 * @param signal - The signal data to match.
 * @returns Array of matched rule ids.
 */
export async function matchSignalToRules(
  organisationId: string | null,
  opportunityId: string,
  signal: {
    title?: string | null;
    summary?: string | null;
    buyer?: string | null;
    estimated_value?: number | null;
    currency?: string | null;
    signal_tier?: string | null;
    vulnerability_trigger?: string | null;
    country?: CountryCode | null;
  },
): Promise<string[]> {
  const queryText = organisationId
    ? `SELECT id, keywords, territories, min_value, max_value, min_tier,
            vulnerability_triggers
       FROM signal_rules
      WHERE organisation_id = $1 AND is_active = TRUE`
    : `SELECT id, keywords, territories, min_value, max_value, min_tier,
            vulnerability_triggers
       FROM signal_rules
      WHERE is_active = TRUE`;

  const rules = await query(queryText, organisationId ? [organisationId] : []);

  if ((rules.rowCount ?? 0) === 0) {
    return [];
  }

  const signalText = `${signal.title ?? ""} ${signal.summary ?? ""} ${signal.buyer ?? ""}`.toLowerCase();
  const signalValueGBP = Number(signal.estimated_value ?? 0);
  const signalTier = signal.signal_tier ?? "STANDARD_COMMERCIAL";
  const signalTrigger = signal.vulnerability_trigger ?? null;
  const signalCountry = signal.country ?? "UK";

  const tierRank: Record<string, number> = {
    STANDARD_COMMERCIAL: 1,
    HIGH_CAP: 2,
    MEGAPROCUREMENT: 3,
  };

  const matchedRuleIds: string[] = [];

  for (const rule of rules.rows as Array<{
    id: string;
    keywords?: string | unknown;
    territories?: string | unknown;
    min_value?: number | null;
    max_value?: number | null;
    min_tier?: string | null;
    vulnerability_triggers?: string | unknown;
  }>) {
    const ruleKeywords: string[] =
      typeof rule.keywords === "string"
        ? JSON.parse(rule.keywords)
        : Array.isArray(rule.keywords)
          ? rule.keywords
          : [];
    const ruleTerritories: string[] =
      typeof rule.territories === "string"
        ? JSON.parse(rule.territories)
        : Array.isArray(rule.territories)
          ? rule.territories
          : [];
    const ruleTriggers: string[] =
      typeof rule.vulnerability_triggers === "string"
        ? JSON.parse(rule.vulnerability_triggers)
        : Array.isArray(rule.vulnerability_triggers)
          ? rule.vulnerability_triggers
          : [];

    // Check keywords: signal text must contain at least one keyword (if any keywords are set)
    if (ruleKeywords.length > 0) {
      const keywordMatch = ruleKeywords.some((k) =>
        signalText.includes(k.toLowerCase()),
      );
      if (!keywordMatch) continue;
    }

    // Check territories: signal country must be in territories (if any are set)
    if (ruleTerritories.length > 0) {
      if (!ruleTerritories.includes(signalCountry)) continue;
    }

    // Check min/max value
    if (rule.min_value !== null && rule.min_value !== undefined) {
      if (signalValueGBP < Number(rule.min_value)) continue;
    }
    if (rule.max_value !== null && rule.max_value !== undefined) {
      if (signalValueGBP > Number(rule.max_value)) continue;
    }

    // Check min tier
    if (rule.min_tier) {
      const ruleTierRank = tierRank[rule.min_tier] ?? 1;
      const signalTierRank = tierRank[signalTier] ?? 1;
      if (signalTierRank < ruleTierRank) continue;
    }

    // Check vulnerability triggers: if rule has triggers, signal must match one
    if (ruleTriggers.length > 0) {
      if (!signalTrigger || !ruleTriggers.includes(signalTrigger)) continue;
    }

    // Match found — create signal_rule_match
    try {
      await query(
        `INSERT INTO signal_rule_matches (signal_rule_id, opportunity_id, matched_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT DO NOTHING`,
        [rule.id, opportunityId],
      );
      matchedRuleIds.push(rule.id);
    } catch {
      // Non-fatal: match recording failure should not block the pipeline.
    }
  }

  // Update match counts for matched rules (best-effort)
  if (matchedRuleIds.length > 0) {
    try {
      await query(
        `UPDATE signal_rules
              SET match_count = match_count + 1,
                  last_matched_at = NOW(),
                  updated_at = NOW()
            WHERE id = ANY($1)`,
        [matchedRuleIds],
      );
    } catch {
      // Non-fatal.
    }
  }

  return matchedRuleIds;
}
