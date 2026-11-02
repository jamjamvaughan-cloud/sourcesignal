/**
 * Centralized URL configuration for SourceSignal.
 *
 * Provides helpers for resolving the application base URL across
 * local development (localhost:3000) and production (https://sourcesignal.site)
 * deployments.
 */

/**
 * Returns the application base URL.
 *
 * Resolution order:
 *   1. Browser (client-side): window.location.origin
 *   2. NEXT_PUBLIC_APP_URL environment variable
 *   3. COOLIFY_URL environment variable (Coolify deployments)
 *   4. Fallback: http://localhost:3000
 */
export function getAppUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl.replace(/\/$/, "");
  }

  const coolifyUrl = process.env.COOLIFY_URL;
  if (coolifyUrl) {
    return coolifyUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

/**
 * Returns the API base URL.
 */
export function getApiUrl(): string {
  return `${getAppUrl()}/api`;
}
