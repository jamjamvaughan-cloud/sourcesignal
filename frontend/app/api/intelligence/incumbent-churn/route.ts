/**
 * Incumbent Churn API.
 *
 * GET /api/intelligence/incumbent-churn
 *
 * Returns churn risk profiles for all buyers — early termination flags,
 * market testing notices, shortened renewal cycles, and "High Churn Risk"
 * accounts where entrenched competitors can be displaced.
 */

import { NextResponse } from "next/server";
import { getAllBuyerChurnProfiles } from "@/lib/incumbent-churn";

export async function GET(): Promise<NextResponse> {
  try {
    const profiles = await getAllBuyerChurnProfiles();
    return NextResponse.json(profiles);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Incumbent churn lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
