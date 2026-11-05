/**
 * Cross-Border Match API.
 *
 * GET /api/intelligence/cross-border-match
 *
 * Returns cross-border matches — identifies pattern replication and
 * equivalent buyer mappings across the 6 jurisdictions. Enables enterprises
 * to take a winning sales pitch from one country and proactively pitch it
 * to equivalent buyers in other countries.
 */

import { NextResponse } from "next/server";
import { getCrossBorderMatches } from "@/lib/cross-border-matchmaker";

export async function GET(): Promise<NextResponse> {
  try {
    const matches = await getCrossBorderMatches();
    return NextResponse.json(matches);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Cross-border match lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
