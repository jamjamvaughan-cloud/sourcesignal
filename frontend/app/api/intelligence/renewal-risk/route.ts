/**
 * Pre-Tender Renewal Risk API.
 *
 * GET /api/intelligence/renewal-risk?canonicalId=...&closingDate=...
 *
 * Returns pre-tender renewal risk assessment for a specific opportunity,
 * including days until expiry and historical re-tender pattern warnings.
 *
 * Pro tier only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getPreTenderRisk } from "@/lib/historical-intelligence";

async function requirePro(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  if (!entitlements.fullDetailsEnabled) {
    return NextResponse.json(
      { error: "Pro tier subscription required" },
      { status: 403 },
    );
  }

  return null;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const authResult = await requirePro(request);
  if (authResult) return authResult;

  const searchParams = request.nextUrl.searchParams;
  const canonicalId = searchParams.get("canonicalId");
  const closingDate = searchParams.get("closingDate") || undefined;

  if (!canonicalId) {
    return NextResponse.json(
      { error: "canonicalId is required." },
      { status: 400 },
    );
  }

  try {
    const risk = await getPreTenderRisk(canonicalId, closingDate);
    if (!risk) {
      return NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(risk);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Renewal risk lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
