/**
 * Commercial plans.
 *
 * SourceSignal operates two plans: Free and Pro. Entitlements declared here
 * are the single source of truth for what each plan may access. These rules
 * must be enforced server-side (see Phase 2+), not merely hidden in the UI.
 */

export interface PlanFeature {
  readonly id: string;
  readonly label: string;
  /** Whether this feature is included in the plan. */
  readonly included: boolean;
  /** Optional note explaining a limitation or condition. */
  readonly note?: string;
}

/** Plan id union type. */
export type PlanId = Plan["id"];

export interface Plan {
  readonly id: "free" | "pro";
  readonly name: string;
  /** Monthly price in pounds (pence precision via string). Undefined = free. */
  readonly priceGbp: number | null;
  readonly description: string;
  readonly features: readonly PlanFeature[];
  /** Whether the interactive opportunity map is available on this plan. */
  readonly mapEnabled: boolean;
  /** Whether raw data exports (CSV/JSON) are available on this plan. */
  readonly exportsEnabled: boolean;
  /** Whether buyer contact emails are shown where lawfully available. */
  readonly buyerEmailsEnabled: boolean;
  /** Whether full opportunity details are available. */
  readonly fullDetailsEnabled: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    priceGbp: null,
    description:
      "Explore all supported sectors with limited opportunity details.",
    features: [
      { id: "all-sectors", label: "Access to all supported sectors", included: true },
      {
        id: "limited-details",
        label: "Opportunity details",
        included: true,
        note: "Limited or truncated opportunity details.",
      },
      {
        id: "raw-exports",
        label: "Raw data exports",
        included: false,
        note: "No raw data exports on Free.",
      },
      {
        id: "opportunity-map",
        label: "Opportunity map",
        included: false,
        note: "Opportunity map locked behind an upgrade gate.",
      },
      {
        id: "buyer-emails",
        label: "Buyer contact emails",
        included: false,
        note: "Not available on Free.",
      },
      {
        id: "valuations",
        label: "Valuation estimates",
        included: false,
        note: "Pro-only feature.",
      },
      {
        id: "alerts",
        label: "Alerts",
        included: false,
        note: "Pro-only feature.",
      },
      {
        id: "full-details",
        label: "Full opportunity details",
        included: false,
        note: "Pro-only feature.",
      },
    ],
    mapEnabled: false,
    exportsEnabled: false,
    buyerEmailsEnabled: false,
    fullDetailsEnabled: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceGbp: 99,
    description:
      "Full procurement intelligence with complete details, exports and the live map.",
    features: [
      { id: "all-sectors", label: "Access to all supported sectors", included: true },
      {
        id: "full-details",
        label: "Full opportunity details",
        included: true,
      },
      {
        id: "buyer-emails",
        label: "Buyer contact emails",
        included: true,
        note: "Where lawfully available.",
      },
      { id: "valuations", label: "Valuation estimates", included: true },
      { id: "raw-exports", label: "CSV and JSON exports", included: true },
      { id: "alerts", label: "Alerts", included: true },
      { id: "opportunity-map", label: "Full interactive opportunity map", included: true },
    ],
    mapEnabled: true,
    exportsEnabled: true,
    buyerEmailsEnabled: true,
    fullDetailsEnabled: true,
  } as const,
] as const;

/** Lookup of plan by id. */
export const PLANS_BY_ID: Record<Plan["id"], Plan> = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
) as Record<Plan["id"], Plan>;

export function getPlan(id: string): Plan | undefined {
  return PLANS_BY_ID[id as Plan["id"]];
}

export const FREE_PLAN = PLANS_BY_ID.free;
export const PRO_PLAN = PLANS_BY_ID.pro;

/** Monthly price of the Pro plan, in pence. */
export const PRO_PRICE_PENCE = 99 * 100;
