/**
 * POST /api/user/preferences
 *
 * Saves the authenticated user's country, industry, and sub-category
 * preferences. These are used to filter the opportunity feed and
 * intelligence modules to the user's target markets.
 *
 * Body:
 *   countryPreferences: string[]   (e.g. ["UK", "US"])
 *   industryPreferences: string[]  (e.g. ["technology-infrastructure", "energy"])
 *   subCategoryPreferences: string[] (e.g. ["cloud-migration", "grid-modernization"])
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { error, info } from "@/lib/logger";
import {
  isValidSector,
  isValidSubCategory,
  TAXONOMY,
} from "@/lib/taxonomy";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: {
    countryPreferences?: unknown;
    industryPreferences?: unknown;
    subCategoryPreferences?: unknown;
  };
  try {
    body = (await request.json()) as {
      countryPreferences?: unknown;
      industryPreferences?: unknown;
      subCategoryPreferences?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const countryPreferences: string[] = Array.isArray(body.countryPreferences)
    ? body.countryPreferences.filter((c): c is string => typeof c === "string")
    : [];

  const industryPreferences: string[] = Array.isArray(body.industryPreferences)
    ? body.industryPreferences.filter(
        (c): c is string => typeof c === "string",
      )
    : [];

  const subCategoryPreferences: string[] = Array.isArray(
    body.subCategoryPreferences,
  )
    ? body.subCategoryPreferences.filter(
        (c): c is string => typeof c === "string",
      )
    : [];

  // Validate sectors against the controlled taxonomy.
  for (const sectorId of industryPreferences) {
    if (!isValidSector(sectorId)) {
      return NextResponse.json(
        { error: `Invalid sector: ${sectorId}` },
        { status: 400 },
      );
    }
  }

  // Validate sub-categories against the controlled taxonomy.
  for (const subCatId of subCategoryPreferences) {
    const sector = TAXONOMY.find((s) =>
      s.subCategories.some((sc) => sc.id === subCatId),
    );
    if (!sector || !isValidSubCategory(sector.id, subCatId)) {
      return NextResponse.json(
        { error: `Invalid sub-category: ${subCatId}` },
        { status: 400 },
      );
    }
  }

  try {
    // Free users are locked to the country chosen at signup. Industry and
    // sub-category preferences remain editable, but the jurisdiction cannot
    // be switched without a Pro subscription (global jurisdiction switching
    // is a Pro feature). This prevents the country lock from being bypassed
    // by writing a new preference and then re-reading the feed.
    const planId = await getUserPlanId(user.id);
    const entitlements = entitlementsFor(planId);

    let effectiveCountryPreferences = countryPreferences;
    if (!entitlements.fullDetailsEnabled) {
      const current = await query(
        `SELECT country_preferences FROM users WHERE id = $1`,
        [user.id],
      );
      const existing = current.rows[0]?.country_preferences;
      const signupCountry =
        Array.isArray(existing) && typeof existing[0] === "string"
          ? existing[0]
          : countryPreferences[0];
      effectiveCountryPreferences = signupCountry ? [signupCountry] : [];
    }

    await query(
      `UPDATE users
        SET country_preferences = $1,
            industry_preferences = $2,
            subcategory_preferences = $3,
            updated_at = NOW()
        WHERE id = $4`,
      [
        effectiveCountryPreferences,
        industryPreferences,
        subCategoryPreferences,
        user.id,
      ],
    );

    info("user_preferences_updated", {
      userId: user.id,
      planId,
      countryPreferences: effectiveCountryPreferences,
      industryPreferences,
      subCategoryPreferences,
    });

    return NextResponse.json({
      success: true,
      countryPreferences: effectiveCountryPreferences,
      industryPreferences,
      subCategoryPreferences,
    });
  } catch (err: unknown) {
    error("user_preferences_update_failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to save preferences." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT country_preferences, industry_preferences, subcategory_preferences
       FROM users
       WHERE id = $1`,
      [user.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      countryPreferences: row.country_preferences ?? [],
      industryPreferences: row.industry_preferences ?? [],
      subCategoryPreferences: row.subcategory_preferences ?? [],
    });
  } catch (err: unknown) {
    error("user_preferences_fetch_failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch preferences." },
      { status: 500 },
    );
  }
}