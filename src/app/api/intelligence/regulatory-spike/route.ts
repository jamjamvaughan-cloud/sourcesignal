/**
 * Regulatory Spike API.
 *
 * GET /api/intelligence/regulatory-spike
 *
 * Returns regulatory spike analysis for all sectors — correlates tender
 * volumes with upcoming regulatory deadlines to explain macro spending
 * waves and surface budget flush indicators.
 */

import { NextResponse } from "next/server";
import { getRegulatorySpikes } from "@/lib/regulatory-spike";

export async function GET(): Promise<NextResponse> {
  try {
    const spikes = await getRegulatorySpikes();
    return NextResponse.json(spikes);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Regulatory spike lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
