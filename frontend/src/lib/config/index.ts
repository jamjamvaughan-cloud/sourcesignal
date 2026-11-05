/**
 * Central configuration barrel.
 *
 * Re-exports sector, region and plan configuration so the rest of the
 * application imports from one stable location: `@/lib/config`.
 */

export type { SectorId } from "./sectors";
export type { Region } from "./regions";
export type { Plan, PlanFeature } from "./plans";
export type { PlanId } from "./plans";

export {
  SECTORS,
  SECTORS_BY_ID,
  isValidSectorId,
} from "./sectors";
export { REGIONS, isValidRegion } from "./regions";
export {
  PLANS,
  PLANS_BY_ID,
  getPlan,
  FREE_PLAN,
  PRO_PLAN,
  PRO_PRICE_PENCE,
} from "./plans";
