/**
 * Opportunities API.
 *
 * GET /api/opportunities — list signals in the legacy opportunity shape.
 * GET /api/opportunities/:id — single signal (entitlement-sanitised).
 *
 * The canonical read path is the `signals` table. The caller's plan and
 * entitlements are derived from their verified session, never from
 * client-supplied parameters.
 *
 * Free-tier rules (enforced server-side):
 *   - only the country chosen at signup (primary country preference);
 *   - only signals published between 2025-01-01 and 24 hours ago;
 *   - Pro-only telemetry is stripped.
 * Pro/Enterprise users may switch jurisdiction via `country` / `region`.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { listOpportunities } from "@/lib/opportunities";
import { entitlementsFor, type Entitlements, type PlanId } from "@/lib/entitlements";
import { rateLimitResponse } from "@/lib/rate-limit";
import { query } from "@/lib/db";

interface CallerContext {
  entitlements: Entitlements;
  plan: PlanId;
  userId: string;
  primaryCountry: string | null;
}

async function getCallerContext(request: NextRequest): Promise<CallerContext> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    throw new Error("Not authenticated.");
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  const result = await query(
    `SELECT country_preferences FROM users WHERE id = $1`,
    [user.id],
  );
  const preferences = result.rows[0]?.country_preferences;
  const primaryCountry =
    Array.isArray(preferences) && typeof preferences[0] === "string"
      ? preferences[0].toUpperCase()
      : (user.country ?? null);

  return {
    entitlements,
    plan: planId,
    userId: user.id,
    primaryCountry,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const rateLimitResult = await rateLimitResponse(request, {
    max: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimitResult) return rateLimitResult;

  let caller: CallerContext;
  try {
    caller = await getCallerContext(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedCountry =
    searchParams.get("country") || searchParams.get("region") || undefined;

  // Free users are locked to their signup country regardless of query input.
  const jurisdiction = caller.entitlements.fullDetailsEnabled
    ? requestedCountry
    : (caller.primaryCountry ?? undefined);

  const filters = {
    sector: searchParams.get("sector") || undefined,
    country: requestedCountry,
    jurisdiction: jurisdiction ?? undefined,
    q: searchParams.get("q") || undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    perPage: searchParams.get("perPage")
      ? Number(searchParams.get("perPage"))
      : undefined,
    sort: searchParams.get("sort") || undefined,
  };

  // Fail closed: a Free account with no stored signup country must not fall
  // through to an unfiltered global feed.
  if (!caller.entitlements.fullDetailsEnabled && !jurisdiction) {
    return NextResponse.json({
      items: [],
      total: 0,
      page: 1,
      perPage: 0,
      totalPages: 0,
      isPro: false,
    });
  }

  try {
    const result = await listOpportunities(caller.entitlements, filters);
    return NextResponse.json({ ...result, isPro: caller.plan === "pro" });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to list opportunities.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
