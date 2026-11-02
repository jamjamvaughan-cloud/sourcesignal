/**
 * Rate limiter (Phase C).
 *
 * Tracks request counts per identifier (IP address or user ID) within a
 * time window. Counters are stored through the resilient cache layer in
 * `@/lib/redis`:
 *   1. Redis (shared across instances) when configured.
 *   2. PostgreSQL `cache_entries` (shared across instances) as a fallback.
 *   3. In-memory Map (single instance) as a last resort.
 *
 * This is defense in depth, not a substitute for platform edge limits.
 */

import { redis, resetMemoryCache } from "@/lib/redis";

export interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  readonly max: number;
  /** Window duration in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter?: number;
}

const KEY_PREFIX = "ratelimit:";

/**
 * Checks whether a request is within the rate limit.
 *
 * @param identifier - Unique identifier for the client (e.g. IP or user ID).
 * @param options - Rate limit configuration.
 * @returns `{ success: true; remaining: number }` when allowed, or
 *   `{ success: false; retryAfter: number }` when rate-limited.
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${KEY_PREFIX}${identifier}`;
  const ttlSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));

  const count = await redis.incr(key, ttlSeconds);

  if (count > options.max) {
    return {
      success: false,
      remaining: 0,
      retryAfter: options.windowMs,
    };
  }

  return {
    success: true,
    remaining: Math.max(0, options.max - count),
  };
}

/**
 * Clears rate-limit counters. useful in tests.
 *
 * The in-memory and shared stores are cleared best-effort; the Redis /
 * PostgreSQL delete is fired asynchronously so this can stay synchronous.
 */
export function resetRateLimit(): void {
  resetMemoryCache(KEY_PREFIX);
  void redis
    .keys(`${KEY_PREFIX}*`)
    .then((keys) => Promise.all(keys.map((key) => redis.del(key))))
    .catch(() => {
      // Best-effort reset only.
    });
}

/**
 * Middleware-style helper for Next.js API routes.
 *
 * Returns a Response when the request should be rejected, or null when
 * allowed. Callers should pass the result to `NextResponse.next()` or
 * return the rejection directly.
 */
export async function rateLimitResponse(
  request: Request,
  options: RateLimitOptions,
): Promise<Response | null> {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const result = await rateLimit(ip, options);

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(
            Math.ceil((result.retryAfter ?? options.windowMs) / 1000),
          ),
        },
      },
    );
  }
  return null;
}
