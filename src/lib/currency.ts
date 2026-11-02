/**
 * Dynamic Exchange Rates Module.
 *
 * Fetches live exchange rates from https://open.er-api.com/v6/latest/GBP
 * with a 24-hour in-memory cache. Falls back safely to hardcoded default
 * rates on network or API failures.
 *
 * All rates are expressed as GBP per 1 unit of foreign currency:
 *   1 USD = 0.79 GBP, 1 EUR = 0.85 GBP, etc.
 */

import { error } from "@/lib/logger";

/** Default baseline exchange rates (1 unit of foreign currency = X GBP). */
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  GBP: 1.0,
  USD: 0.79,
  EUR: 0.85,
  CAD: 0.58,
  AUD: 0.52,
} as const;

/** Cache entry: exchange rates + timestamp of last fetch. */
interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

/** 24-hour cache TTL in milliseconds. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** ER-API v6 endpoint for GBP-based rates. */
const ER_API_URL = "https://open.er-api.com/v6/latest/GBP";

/** In-memory cache (single module-level instance). */
let rateCache: RateCache | null = null;

/**
 * Returns exchange rates to GBP, fetching from the ER-API if the cache is
 * stale or empty. Falls back to hardcoded defaults on any failure.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  // Return cached rates if still fresh.
  if (rateCache && now - rateCache.fetchedAt < CACHE_TTL_MS) {
    return rateCache.rates;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(ER_API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ER-API returned ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const rates = data.rates as Record<string, number> | undefined;

    if (!rates || typeof rates !== "object") {
      throw new Error("ER-API response missing rates object");
    }

    // Ensure GBP is always 1.0.
    const normalizedRates: Record<string, number> = {
      ...rates,
      GBP: 1.0,
    };

    rateCache = { rates: normalizedRates, fetchedAt: now };
    return normalizedRates;
  } catch (err) {
    error("currency", {
      error: err instanceof Error ? err.message : String(err),
      fallback: "Using hardcoded default exchange rates",
    });
    return { ...DEFAULT_EXCHANGE_RATES };
  }
}

/**
 * Converts a monetary value to GBP using dynamic exchange rates.
 * Falls back to the original value if the currency is unknown.
 */
export async function convertToGBP(
  value: number,
  currency?: string,
): Promise<number> {
  if (!currency) return value;
  const rates = await getExchangeRates();
  const rate = rates[currency.toUpperCase()];
  if (rate === undefined) return value;
  return value * rate;
}

/**
 * Returns the exchange rate for a currency to GBP.
 * Returns 1.0 for GBP, or undefined if the currency is unknown.
 */
export async function getRateToGBP(currency: string): Promise<number | undefined> {
  const rates = await getExchangeRates();
  return rates[currency.toUpperCase()];
}

/**
 * Clears the exchange rate cache, forcing the next call to refetch.
 * Useful for testing or manual cache invalidation.
 */
export function clearRateCache(): void {
  rateCache = null;
}

/**
 * Returns the last cache fetch timestamp, or null if never fetched.
 */
export function getRateCacheTimestamp(): number | null {
  return rateCache?.fetchedAt ?? null;
}

/**
 * Returns whether the cache is currently stale (older than TTL).
 */
export function isRateCacheStale(): boolean {
  if (!rateCache) return true;
  return Date.now() - rateCache.fetchedAt >= CACHE_TTL_MS;
}
