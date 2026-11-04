/**
 * Central entitlement system for SourceSignal.
 *
 * This is the single source of truth for what each plan may access. All
 * entitlement decisions are made here and enforced server-side. Client
 * components call `can*` / `entitlementsFor` functions exposed via server
 * actions or API routes; they never trust client-supplied plan or entitlement
 * flags.
 */

import {
  PLANS_BY_ID,
  type Plan,
  type PlanId,
} from "@/lib/config";

export type { PlanId };

/** Entitlement flags derived from a plan. */
export interface Entitlements {
  readonly plan: Plan;
  readonly mapEnabled: boolean;
  readonly exportsEnabled: boolean;
  readonly buyerEmailsEnabled: boolean;
  readonly fullDetailsEnabled: boolean;
  readonly alertsEnabled: boolean;
}

/**
 * Returns the entitlements for a plan id. Throws for an unknown plan id.
 */
export function entitlementsFor(planId: PlanId): Entitlements {
  const plan = PLANS_BY_ID[planId];
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  const alertsFeature = plan.features.find((f) => f.id === "alerts");
  return {
    plan,
    mapEnabled: plan.mapEnabled,
    exportsEnabled: plan.exportsEnabled,
    buyerEmailsEnabled: plan.buyerEmailsEnabled,
    fullDetailsEnabled: plan.fullDetailsEnabled,
    alertsEnabled: plan.id === "pro" && Boolean(alertsFeature?.included),
  };
}

/** Default entitlements for the Free plan. */
export const FREE_ENTITLEMENTS: Entitlements = entitlementsFor("free");

/** Default entitlements for the Pro plan. */
export const PRO_ENTITLEMENTS: Entitlements = entitlementsFor("pro");

/**
 * Can the user access the interactive opportunity map and its data?
 */
export function canAccessMap(entitlements: Entitlements): boolean {
  return entitlements.mapEnabled;
}

/**
 * Can the user download raw CSV/JSON exports?
 */
export function canExport(entitlements: Entitlements): boolean {
  return entitlements.exportsEnabled;
}

/**
 * Can the user view buyer contact emails (where lawfully available)?
 */
export function canViewBuyerEmails(entitlements: Entitlements): boolean {
  return entitlements.buyerEmailsEnabled;
}

/**
 * Can the user view full opportunity details?
 */
export function canViewFullDetails(entitlements: Entitlements): boolean {
  return entitlements.fullDetailsEnabled;
}

/**
 * Can the user configure alerts?
 */
export function canConfigureAlerts(entitlements: Entitlements): boolean {
  return entitlements.alertsEnabled;
}

/**
 * Returns the fields permitted for a given plan. Free receives deliberately
 * limited/truncated detail fields; Pro receives all permitted fields.
 */
export function permittedOpportunityFields(
  entitlements: Entitlements,
): readonly string[] {
  const base = [
    "id",
    "canonical_id",
    "title",
    "summary",
    "buyer",
    "sector",
    "region",
    "country",
    "location",
    "published_date",
    "closing_date",
    "procurement_stage",
    "source_url",
    "source_name",
    "source_hash",
    "source_captured_at",
    "confidence",
    "signal_tier",
    "opportunity_type",
    "sub_category",
    "supplier_capabilities",
    "created_at",
    "updated_at",
    "is_demonstration",
  ];
  if (entitlements.fullDetailsEnabled) {
    return [
      ...base,
      // Pro-only telemetry. Free users must never receive these fields:
      // no valuation, no commercial rationale, no score, no incumbent /
      // trigger intelligence.
      "estimated_value",
      "currency",
      "opportunity_score",
      "commercial_why",
      "vulnerability_trigger",
      "winner",
      "latitude",
      "longitude",
      "detail_fields",
    ];
  }
  // Free: limited/truncated details. No valuation, no coordinates, no
  // unstructured detail fields, no buyer contact emails.
  return base;
}

/**
 * Returns a sanitized opportunity record for a given plan. Restricted fields
 * are stripped before the record ever leaves the server.
 */
export function sanitizeOpportunity(
  opportunity: Record<string, unknown>,
  entitlements: Entitlements,
): Record<string, unknown> {
  const permitted = new Set(permittedOpportunityFields(entitlements));
  const sanitized: Record<string, unknown> = {};
  for (const field of permitted) {
    if (field in opportunity) {
      sanitized[field] = opportunity[field];
    }
  }
  // Buyer contact emails are never returned in the base opportunity record;
  // they are available through a separate, separately-gated endpoint.
  delete sanitized["buyer_email"];
  return sanitized;
}
