/**
 * Authentication helpers for SourceSignal.
 *
 * Authentication is handled via JWT session cookies. Server-side routes read
 * the session cookie to verify the user's identity — they never trust
 * client-supplied user IDs or plan names.
 */

import { query } from "@/lib/db";
import { getSession } from "@/lib/redis";
import { error } from "@/lib/logger";
import { type PlanId } from "@/lib/entitlements";

/** Name of the session cookie. */
export const SESSION_COOKIE = "session_id";

/** Session lifetime: 7 days. */
export const SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * Builds a `Set-Cookie` value for a session token. Adds `Secure` in
 * production so the cookie is never sent over plain HTTP.
 *
 * In production the cookie is scoped to the root domain
 * (sourcesignal.site) so it is sent to both the frontend (sourcesignal.site)
 * and the API subdomain (api.sourcesignal.site). SameSite=None is required
 * for cross-site POST requests (signin/signup) from the frontend to the API.
 */
export function buildSessionCookie(
  token: string,
  maxAge: number = SESSION_TTL,
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const domain =
    process.env.NODE_ENV === "production" ? "; Domain=sourcesignal.site" : "";
  const sameSite =
    process.env.NODE_ENV === "production" ? "; SameSite=None" : "; SameSite=Lax";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly${sameSite}; Max-Age=${maxAge}${secure}${domain}`;
}

/** Cookie value that clears the session cookie. */
export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const domain =
    process.env.NODE_ENV === "production" ? "; Domain=sourcesignal.site" : "";
  const sameSite =
    process.env.NODE_ENV === "production" ? "; SameSite=None" : "; SameSite=Lax";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${sameSite}; Max-Age=0${secure}${domain}`;
}

/** Extracts the session token from a raw `Cookie` header. */
export function readSessionToken(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`),
  );
  return match?.[1] ?? null;
}

/** Normalises stored plan values to the two plans the app supports. */
function normalisePlan(value: unknown): PlanId {
  if (value === "pro" || value === "enterprise" || value === "business") {
    return "pro";
  }
  return "free";
}

/**
 * Returns the authenticated user's effective plan.
 *
 * Resolution order (highest priority first):
 *   1. An active/trialing row in `user_subscriptions` (Stripe is the source
 *      of truth for paid access).
 *   2. The organisation's `plan` column.
 *   3. The user's legacy `subscription_tier` column.
 *   4. "free".
 *
 * Never throws — a database failure degrades to "free" rather than leaking
 * paid access.
 */
export async function getUserPlanId(userId: string): Promise<PlanId> {
  try {
    const result = await query(
      `SELECT COALESCE(
                (
                  SELECT us.plan_tier
                    FROM user_subscriptions us
                   WHERE us.user_id = u.id
                     AND us.status IN ('active', 'trialing')
                   ORDER BY us.updated_at DESC NULLS LAST
                   LIMIT 1
                ),
                o.plan,
                u.subscription_tier,
                'free'
              ) AS plan_tier
         FROM users u
         LEFT JOIN LATERAL (
           SELECT org.plan
             FROM memberships m
             JOIN organisations org ON org.id = m.organisation_id
            WHERE m.user_id = u.id
            ORDER BY CASE WHEN org.plan = 'free' THEN 1 ELSE 0 END
            LIMIT 1
         ) o ON TRUE
        WHERE u.id = $1`,
      [userId],
    );

    if ((result.rowCount ?? 0) === 0) return "free";
    return normalisePlan(result.rows[0]?.plan_tier);
  } catch (err: unknown) {
    error("auth_plan_lookup_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "free";
  }
}

/**
 * Backwards-compatible alias. Older route handlers and scripts still import
 * the PocketBase-era name; it now resolves through native PostgreSQL.
 */
export const getUserPlanIdFromPB = getUserPlanId;

/** Returns the user's primary organisation, or null when they have none. */
export async function getUserOrganisation(userId: string): Promise<{
  id: string;
  name: string;
  country: string | null;
  plan: string;
  stripeCustomerId: string | null;
} | null> {
  const result = await query(
    `SELECT o.id, o.name, o.country, o.plan, o.stripe_customer_id
       FROM organisations o
       JOIN memberships m ON m.organisation_id = o.id
      WHERE m.user_id = $1
      ORDER BY m.created_at ASC NULLS LAST
      LIMIT 1`,
    [userId],
  );

  if ((result.rowCount ?? 0) === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    country: (row.country as string | null) ?? null,
    plan: (row.plan as string | null) ?? "free",
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
  };
}

/**
 * Returns the authenticated user record from the request cookies, or null when
 * unauthenticated. Server-side use only.
 *
 * A missing/invalid session is an expected 401 case; database failures are
 * logged with context so they can be distinguished from "not signed in".
 */
export async function getCurrentUser(
  cookieHeader: string | null,
): Promise<{
  id: string;
  email: string;
  role?: string;
  country?: string | null;
} | null> {
  if (!cookieHeader) return null;

  const sessionId = readSessionToken(cookieHeader);
  if (!sessionId) return null;

  try {
    const session = await getSession(sessionId);
    if (!session) return null;

    const userResult = await query(
      `SELECT u.id, u.email,
             o.country,
             u.country_preferences
         FROM users u
         LEFT JOIN LATERAL (
           SELECT org.country
             FROM memberships m
             JOIN organisations org ON org.id = m.organisation_id
            WHERE m.user_id = u.id
            ORDER BY m.created_at ASC NULLS LAST
            LIMIT 1
         ) o ON TRUE
        WHERE u.id = $1`,
      [session.userId],
    );

    if ((userResult.rowCount ?? 0) === 0) return null;

    const row = userResult.rows[0];
    return {
      id: row.id as string,
      email: row.email as string,
      country:
        (row.country as string | null) ??
        (Array.isArray(row.country_preferences) && row.country_preferences[0]
          ? row.country_preferences[0]
          : null),
    };
  } catch (err: unknown) {
    error("auth_session_lookup_failed", {
      sessionId: sessionId.slice(0, 12),
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return null;
  }
}
