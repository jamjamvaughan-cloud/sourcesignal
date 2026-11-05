/**
 * Server-side client for the SourceSignal backend API.
 *
 * The frontend deployment (Vercel) never talks to PostgreSQL, Redis or Stripe
 * directly. Server Components call this helper, which forwards the incoming
 * session cookie to the backend deployment (the VPS) over HTTP.
 *
 * `NEXT_PUBLIC_API_URL` must be set on the frontend deployment, e.g.
 *   NEXT_PUBLIC_API_URL="https://api.sourcesignal.site"
 *
 * `BACKEND_URL` is accepted as a legacy alias.
 *
 * When the app is running on the VPS itself (or in local development) the
 * helper falls back to the local Next.js server, so the same code works in
 * every environment.
 */

import { headers } from "next/headers";
import type { PlanId } from "@/lib/entitlements";

export interface SessionUser {
  id: string;
  email: string;
  country: string | null;
}

export interface SessionContext {
  user: SessionUser | null;
  planId: PlanId;
}

/**
 * Resolves the backend origin for server-to-server calls.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_API_URL` (set on Vercel, e.g. https://api.sourcesignal.site)
 *   2. `BACKEND_URL` (legacy alias)
 *   3. `API_BACKEND_URL` (legacy alias)
 *   4. local Next.js server (VPS deployment / local development)
 */
export function getBackendBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    process.env.API_BACKEND_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.VERCEL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Configure it with the VPS API origin " +
        "(for example https://api.sourcesignal.site).",
    );
  }

  return `http://127.0.0.1:${process.env.PORT?.trim() || "3000"}`;
}

/**
 * Calls the backend API, forwarding the current request's session cookie.
 *
 * Always uncached: dashboard data is user-scoped and must never be served
 * from a shared cache.
 */
export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cookieHeader = (await headers()).get("cookie");
  const url = `${getBackendBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const requestHeaders = new Headers(init.headers);
  if (cookieHeader && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookieHeader);
  }

  return fetch(url, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
    // Fail fast instead of hanging a server render if the VPS is unreachable.
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

interface AuthMeResponse {
  user?: {
    id?: unknown;
    email?: unknown;
    country?: unknown;
  };
  plan?: unknown;
}

/**
 * Resolves the current visitor's user + plan from the backend.
 *
 * Never throws: a missing session or an unavailable backend degrades to an
 * unauthenticated Free context, matching the previous direct-DB behaviour.
 */
export async function getSessionContext(): Promise<SessionContext> {
  try {
    // Call the frontend's own /api/auth/me route (Next.js API handler) which
    // resolves the session against the local PostgreSQL database. Do not use
    // backendFetch() here — that targets the backend VPS at a different path
    // (/auth/me) and returns a different response shape.
    const cookieHeader = (await headers()).get("cookie");
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/me`,
      {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return { user: null, planId: "free" };
    }

    const data = (await response.json()) as AuthMeResponse;
    const id = typeof data.user?.id === "string" ? data.user.id : null;
    const email =
      typeof data.user?.email === "string" ? data.user.email : null;
    if (!id || !email) {
      return { user: null, planId: "free" };
    }

    return {
      user: {
        id,
        email,
        country:
          typeof data.user?.country === "string" ? data.user.country : null,
      },
      planId: data.plan === "pro" ? "pro" : "free",
    };
  } catch {
    return { user: null, planId: "free" };
  }
}

/** Fetches and parses JSON from the backend, returning null on any failure. */
export async function backendJson<T>(path: string): Promise<T | null> {
  try {
    const response = await backendFetch(path);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
