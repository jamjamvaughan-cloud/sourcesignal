/**
 * Authentication helpers for SourceSignal.
 *
 * Authentication is handled via JWT session cookies. Server-side routes read
 * the session cookie to verify the user's identity — they never trust
 * client-supplied user IDs or plan names.
 */

import { query } from "@/lib/db";
import { getSession } from "@/lib/redis";
import { type PlanId } from "@/lib/entitlements";

/** Name of the session cookie. */
export const SESSION_COOKIE = "session_id";

/** Session lifetime: 7 days. */
export const SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * Builds a `Set-Cookie` value for a session token. Adds `Secure` in
 * production so the cookie is never sent over plain HTTP.
 */
export function buildSessionCookie(
  token: string,
  maxAge: number = SESSION_TTL,
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Cookie value that clears the session cookie. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
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

/**
 * Returns the authenticated user's plan from their organisation membership
 * in PostgreSQL. Returns "free" if no organisation membership exists or if
 * the user is not found.
 */
export async function getUserPlanIdFromPB(userId: string): Promise<PlanId> {
  try {
    const result = await query(
      `SELECT u.subscription_tier
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN organisations o ON o.id = m.organisation_id
       WHERE u.id = $1`,
      [userId],
    );
    if (result.rowCount === 0) return "free";
    return (result.rows[0].subscription_tier as PlanId) ?? "free";
  } catch {
    return "free";
  }
}

/**
 * Returns the authenticated user record from the request cookies, or null when
 * unauthenticated. Server-side use only.
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
      `SELECT u.id, u.email, o.country
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN organisations o ON o.id = m.organisation_id
       WHERE u.id = $1`,
      [session.userId],
    );

    if (userResult.rowCount === 0) return null;

    return {
      id: userResult.rows[0].id,
      email: userResult.rows[0].email,
      country: userResult.rows[0].country ?? null,
    };
  } catch {
    return null;
  }
}
