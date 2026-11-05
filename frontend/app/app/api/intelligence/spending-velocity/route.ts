/**
 * Buyer Spending Velocity API.
 *
 * GET /api/intelligence/spending-velocity?buyer=...
 *
 * Detects budget flush indicators when a buyer accelerates posting
 * frequency beyond baseline (e.g., fiscal year-end).
 */

import { NextRequest, NextResponse } from "next/server";
import { getBuyerSpendingVelocity } from "@/lib/historical-intelligence";

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const buyer = searchParams.get("buyer");

  if (!buyer) {
    return NextResponse.json(
      { error: "buyer is required." },
      { status: 400 },
    );
  }

  try {
    const velocity = await getBuyerSpendingVelocity(buyer);
    return NextResponse.json(velocity);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Spending velocity lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
