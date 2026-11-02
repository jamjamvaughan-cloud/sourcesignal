/**
 * Framework Runway API.
 *
 * GET /api/intelligence/framework-runway
 *
 * Returns framework runway analysis for all active frameworks — unspent
 * budget, expiry risk, PIN early intent signals, and market engagement
 * detection. Enables users to "steal deals during the shaping phase."
 */

import { NextResponse } from "next/server";
import { getFrameworkRunway } from "@/lib/framework-runway";

export async function GET(): Promise<NextResponse> {
  try {
    const runways = await getFrameworkRunway();
    return NextResponse.json(runways);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Framework runway lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
