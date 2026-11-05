import { NextRequest, NextResponse } from "next/server";
import { healthCheck } from "@/lib/db";

export async function GET(request: NextRequest) {
  // Debug endpoint - only available in non-production environments.
  // Never exposes connection strings or credentials.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }

  const db = await healthCheck();
  return NextResponse.json({
    database: db ? "connected" : "disconnected",
    environment: process.env.NODE_ENV,
  });
}
