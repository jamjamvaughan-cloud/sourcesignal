/**
 * Dynamic Exchange Rates Module (Worker).
 *
 * Mirrors src/lib/currency.ts for the worker process. Fetches live exchange
 * rates from https://open.er-api.com/v6/latest/GBP with a 24-hour in-memory
 * cache. Falls back safely to hardcoded default rates on failure.
 */

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  GBP: 1.0,
  USD: 0.79,
  EUR: 0.85,
  CAD: 0.58,
  AUD: 0.52,
} as const;

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ER_API_URL = "https://open.er-api.com/v6/latest/GBP";

let rateCache: RateCache | null = null;

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

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

    const normalizedRates: Record<string, number> = {
      ...rates,
      GBP: 1.0,
    };

    rateCache = { rates: normalizedRates, fetchedAt: now };
    return normalizedRates;
  } catch (err) {
    console.error(
      `[worker] Currency fetch failed:`,
      err instanceof Error ? err.message : String(err),
      "- Using hardcoded default exchange rates",
    );
    return { ...DEFAULT_EXCHANGE_RATES };
  }
}

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

export async function getRateToGBP(
  currency: string,
): Promise<number | undefined> {
  const rates = await getExchangeRates();
  return rates[currency.toUpperCase()];
}

export function clearRateCache(): void {
  rateCache = null;
}

export function getRateCacheTimestamp(): number | null {
  return rateCache?.fetchedAt ?? null;
}

export function isRateCacheStale(): boolean {
  if (!rateCache) return true;
  return Date.now() - rateCache.fetchedAt >= CACHE_TTL_MS;
}
