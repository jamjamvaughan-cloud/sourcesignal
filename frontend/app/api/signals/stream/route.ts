/**
 * Server-Sent Events (SSE) Streaming Endpoint.
 *
 * GET /api/signals/stream
 *
 * Streams live high-velocity signals to connected dashboard clients.
 * Polls PostgreSQL every few seconds for newly created signals in the
 * unified `signals` table and pushes them as SSE events.
 *
 * Requires an authenticated session. Free users see signals from their own
 * signup country with Pro-only telemetry fields redacted. Pro/Enterprise
 * users see all signals with full telemetry.
 *
 * Uses text/event-stream content type.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { error, info } from "@/lib/logger";

/** How often each connection polls for new signals. */
const POLL_INTERVAL_MS = 5_000;

/** Signal sectors streamed in real time (all sectors). */
const STREAMED_SECTORS = [
  "TECH",
  "ENERGY",
  "HEALTHCARE",
  "PUBLIC_SECTOR",
  "CONSTRUCTION",
  "TRANSPORT",
  "LOGISTICS",
];

// Connected SSE clients (used only for connection-count logging).
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

/**
 * Authenticates the request and returns the user's session + entitlements.
 * Returns null if the user is not authenticated.
 */
async function requireAuth(): Promise<{
  userId: string;
  country: string | null;
  entitlements: ReturnType<typeof entitlementsFor>;
  isPro: boolean;
} | null> {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  if (!cookieHeader) return null;

  const user = await getCurrentUser(cookieHeader);
  if (!user) return null;

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);
  const isPro = entitlements.fullDetailsEnabled || entitlements.alertsEnabled;

  return { userId: user.id, country: user.country ?? null, entitlements, isPro };
}

/**
 * Sanitize a signal row for Free-tier users by stripping Pro-only telemetry
 * fields. Pro users get the full payload.
 */
function sanitizeSignalForUser(
  row: Record<string, unknown>,
  isPro: boolean,
): Record<string, unknown> {
  if (isPro) return row;

  return {
    id: row.id,
    title: row.title,
    buyer_name: row.buyer_name,
    jurisdiction: row.jurisdiction,
    sector: row.sector,
    opportunity_type: row.opportunity_type,
    // Pro-only fields stripped for Free users
    estimated_value: null,
    source_name: row.source_name,
    source_url: row.source_url,
    source_hash: row.source_hash,
    sha256_hash: row.sha256_hash,
    commercial_why: null,
    published_at: row.published_at,
    created_at: row.created_at,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Authenticate the request. Zero-delay streaming is a Pro/Enterprise
  // capability: Free users receive the historical feed via /api/signals,
  // never embargoed real-time events.
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 },
    );
  }

  const { userId, isPro } = auth;
  if (!isPro) {
    return NextResponse.json(
      { error: "Real-time streaming requires a Pro subscription." },
      { status: 403 },
    );
  }

  const requestedRegion =
    request.nextUrl.searchParams.get("region")?.trim().toUpperCase() ?? null;
  const region =
    requestedRegion && ["UK", "US", "EU"].includes(requestedRegion)
      ? requestedRegion
      : null;

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastSeen = new Date();
  let self: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      self = controller;
      clients.add(controller);
      info("sse_stream", {
        message: "SSE client connected",
        userId,
        region,
        isPro,
        totalClients: clients.size,
      });

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", clients: clients.size })}\n\n`,
        ),
      );

      const poll = async () => {
        try {
          const conditions: string[] = [];
          const params: unknown[] = [];
          let paramIndex = 1;

          // Every streamed signal must be newer than the last event we sent.
          conditions.push(`created_at > $${paramIndex++}`);
          params.push(lastSeen.toISOString());

          // Pro users may stream globally; an explicit `region` query param
          // scopes the stream to the selected jurisdiction.
          if (region) {
            conditions.push(`jurisdiction = $${paramIndex++}`);
            params.push(region);
          }

          const result = await query(
            `SELECT id, title, buyer_name, jurisdiction, sector,
                    opportunity_type, estimated_value, source_name, source_url,
                    source_hash, sha256_hash, commercial_why, published_at,
                    created_at
               FROM signals
              WHERE ${conditions.join(" AND ")}
              ORDER BY created_at ASC
              LIMIT 50`,
            params,
          );

          if ((result.rowCount ?? 0) === 0) {
            // Heartbeat keeps proxies from closing the connection.
            controller.enqueue(encoder.encode(`: ping\n\n`));
            return;
          }

          for (const row of result.rows) {
            lastSeen = new Date(row.created_at as string);
            const sanitized = sanitizeSignalForUser(row, isPro);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "signal", ...sanitized })}\n\n`,
              ),
            );
          }
        } catch (err: unknown) {
          error("sse_stream", {
            error: err instanceof Error ? err.stack ?? err.message : String(err),
          });
        }
      };

      timer = setInterval(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      if (timer) clearInterval(timer);
      timer = null;
      if (self) clients.delete(self);
      info("sse_stream", {
        message: "SSE client disconnected",
        userId,
        totalClients: clients.size,
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const dynamic = "force-dynamic";
