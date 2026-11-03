/**
 * Opportunities API.
 *
 * GET    /api/opportunities — list with filters (entitlement-sanitized)
 * GET    /api/opportunities/:id — single opportunity (entitlement-sanitized)
 *
 * The caller's plan/entitlements are derived from their verified session and
 * organisation membership — never from client-supplied parameters.
 *
 * When user country/industry preferences are set, results are filtered to
 * match those preferences before entitlement sanitization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { listOpportunities } from "@/lib/opportunities";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimitResponse } from "@/lib/rate-limit";
import type { PlanId } from "@/lib/entitlements";

async function getEntitlements(
  request: NextRequest,
): Promise<{
  entitlements: import("@/lib/entitlements").Entitlements;
  plan: PlanId;
  userId: string;
  countryPreferences: string[];
  industryPreferences: string[];
  subCategoryPreferences: string[];
}> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    throw new Error("Not authenticated.");
  }
  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  // Fetch user preferences from the database.
  const result = await query(
    `SELECT country_preferences, industry_preferences, subcategory_preferences
      FROM users WHERE id = $1`,
    [user.id],
  );
  const row = result.rows[0];
  const countryPreferences: string[] = row?.country_preferences ?? [];
  const industryPreferences: string[] = row?.industry_preferences ?? [];
  const subCategoryPreferences: string[] = row?.subcategory_preferences ?? [];

  return {
    entitlements,
    plan: planId,
    userId: user.id,
    countryPreferences,
    industryPreferences,
    subCategoryPreferences,
  };
}

import { query } from "@/lib/db";

export async function GET(
  request: NextRequest,
): Promise<Response> {
  const rateLimitResult = await rateLimitResponse(request, {
    max: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimitResult) return rateLimitResult;

  let entitlements: import("@/lib/entitlements").Entitlements;
  let countryPreferences: string[] = [];
  let industryPreferences: string[] = [];
  let subCategoryPreferences: string[] = [];
  try {
    ({ entitlements, countryPreferences, industryPreferences, subCategoryPreferences } =
      await getEntitlements(request));
  } catch {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filters = {
    sector: searchParams.get("sector") || undefined,
    region: searchParams.get("region") || undefined,
    country: searchParams.get("country") || undefined,
    q: searchParams.get("q") || undefined,
    stage: searchParams.get("stage") || undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    perPage: searchParams.get("perPage")
      ? Number(searchParams.get("perPage"))
      : undefined,
    sort: searchParams.get("sort") || undefined,
    // User preferences for filtering
    userCountryPreferences: countryPreferences.length > 0
      ? countryPreferences
      : undefined,
    userIndustryPreferences: industryPreferences.length > 0
      ? industryPreferences
      : undefined,
    userSubCategoryPreferences: subCategoryPreferences.length > 0
      ? subCategoryPreferences
      : undefined,
  };

  try {
    const result = await listOpportunities(entitlements, filters);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list opportunities.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}