/**
 * Server-Sent Events (SSE) Streaming Endpoint.
 *
 * GET /api/signals/stream
 *
 * Streams live high-velocity signals to connected Pro dashboard clients.
 * The previous implementation subscribed to PocketBase real-time changes;
 * this version polls PostgreSQL every few seconds for newly created
 * MEGAPROCUREMENT / HIGH_CAP opportunities and pushes them as SSE events.
 *
 * Requires Pro subscription. Uses text/event-stream content type.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { query } from "@/lib/db";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { error, info } from "@/lib/logger";

/** How often each connection polls for new signals. */
const POLL_INTERVAL_MS = 5_000;

/** Signal tiers streamed in real time. */
const STREAMED_TIERS = ["MEGAPROCUREMENT", "HIGH_CAP"];

// Connected SSE clients (used only for connection-count logging).
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

/**
 * Authenticates the request and returns the user's entitlements.
 * Returns null if the user is not authenticated or not Pro.
 */
async function requireProEntitlement(): Promise<{
  entitlements: ReturnType<typeof entitlementsFor>;
} | null> {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  if (!cookieHeader) return null;

  const user = await getCurrentUser(cookieHeader);
  if (!user) return null;

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  if (!entitlements.mapEnabled && !entitlements.fullDetailsEnabled) {
    return null;
  }

  return { entitlements };
}

export async function GET(): Promise<NextResponse> {
  // Authenticate and check Pro entitlement.
  const auth = await requireProEntitlement();
  if (!auth) {
    return NextResponse.json(
      { error: "Pro subscription required." },
      { status: 403 },
    );
  }

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
        totalClients: clients.size,
      });

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", clients: clients.size })}\n\n`,
        ),
      );

      const poll = async () => {
        try {
          const result = await query(
            `SELECT id, canonical_id, title, buyer, sector, region, country,
                    signal_tier, estimated_value, currency, source_url, created_at
               FROM opportunities
              WHERE created_at > $1
                AND signal_tier = ANY($2::text[])
              ORDER BY created_at ASC
              LIMIT 50`,
            [lastSeen.toISOString(), STREAMED_TIERS],
          );

          if ((result.rowCount ?? 0) === 0) {
            // Heartbeat keeps proxies from closing the connection.
            controller.enqueue(encoder.encode(`: ping\n\n`));
            return;
          }

          for (const row of result.rows) {
            lastSeen = new Date(row.created_at as string);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "opportunity", ...row })}\n\n`,
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
