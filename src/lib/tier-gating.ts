/**
 * Tier gating logic for Free vs Pro users.
 *
 * Centralizes all feature access decisions based on the user's plan.
 * Free users are restricted; Pro users have full access.
 */

import { type PlanId } from "@/lib/entitlements";

/** Daily view limit for Free users. */
export const FREE_DAILY_VIEW_LIMIT = 10;

/** Maximum sectors Free users can select. Free users can select all 15 sectors. */
export const FREE_MAX_SECTORS = 15;

/** Value threshold (£) above which values are blurred for Free users. */
export const FREE_VALUE_BLUR_THRESHOLD = 5_000_000;

/**
 * Checks if the user can access full real-time feeds (all 18 sources).
 */
export function canAccessFullFeeds(planId: PlanId): boolean {
  return planId === "pro";
}

/**
 * Checks if the user can access unlimited exports (CSV/PDF).
 */
export function canExportUnlimited(planId: PlanId): boolean {
  return planId === "pro";
}

/**
 * Checks if the user can access full map drill-downs.
 */
export function canAccessFullMap(planId: PlanId): boolean {
  return planId === "pro";
}

/**
 * Checks if the user can configure webhook/API integrations.
 */
export function canConfigureIntegrations(planId: PlanId): boolean {
  return planId === "pro";
}

/**
 * Checks if the user can view unblurred contract values above the threshold.
 */
export function canViewFullValues(planId: PlanId): boolean {
  return planId === "pro";
}

/**
 * Returns the maximum number of sectors a user can select for feed filtering.
 */
export function getMaxSelectedSectors(planId: PlanId): number {
  return planId === "pro" ? 15 : FREE_MAX_SECTORS;
}

/**
 * Returns the daily view limit for the user's plan.
 */
export function getDailyViewLimit(planId: PlanId): number {
  return planId === "pro" ? Infinity : FREE_DAILY_VIEW_LIMIT;
}

/**
 * Formats a value for display, blurring if above threshold for Free users.
 */
export function formatValueForPlan(
  value: number | null | undefined,
  currency: string | null | undefined,
  planId: PlanId,
): string {
  if (value == null) return "—";

  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  if (planId === "free" && value >= FREE_VALUE_BLUR_THRESHOLD) {
    return "£5M+";
  }

  return formatted;
}

/**
 * Returns an upgrade prompt message for locked features.
 */
export function getUpgradeMessage(feature: string): string {
  const messages: Record<string, string> = {
    fullFeeds: "Upgrade to Pro for full access to all 18 intelligence feeds.",
    exports: "Upgrade to Pro for unlimited CSV and PDF exports.",
    fullMap: "Upgrade to Pro for full map drill-downs and geospatial analysis.",
    integrations: "Upgrade to Pro for custom webhook and API integrations.",
    fullValues: "Upgrade to Pro to view full contract valuations.",
    sectorLimit: "All 15 sectors are available on Free. Upgrade to Pro for intelligence features.",
    dailyLimit: "You've reached your daily view limit. Upgrade to Pro for unlimited access.",
  };
  return messages[feature] || "Upgrade to Pro to unlock this feature.";
}
