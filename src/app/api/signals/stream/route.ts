/**
 * Server-Sent Events (SSE) Streaming Endpoint.
 *
 * GET /api/signals/stream
 *
 * Streams live high-velocity signals directly to connected Pro dashboard
 * clients in real-time. Subscribes to PocketBase real-time changes on the
 * opportunities collection and pushes MEGAPROCUREMENT and HIGH_CAP signals
 * to connected clients as they are ingested.
 *
 * Requires Pro subscription. Uses text/event-stream content type.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { getCurrentUser } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { type PlanId } from "@/lib/entitlements";
import { error, info } from "@/lib/logger";

// Connected SSE clients.
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

/** Broadcast a signal to all connected SSE clients. */
function broadcast(signal: unknown): void {
  const data = `data: ${JSON.stringify(signal)}\n\n`;
  const encoded = new TextEncoder().encode(data);
  for (const controller of Array.from(clients)) {
    try {
      controller.enqueue(encoded);
    } catch {
      clients.delete(controller);
    }
  }
}

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

  const pb = await getAdminPb();
  if (!pb) return null;

  try {
    const memberships = await pb.collection("memberships").getList(1, 1, {
      filter: `user = "${user.id}"`,
    });
    if (memberships.items.length === 0) return null;
    const membership = memberships.items[0];
    const org = await pb.collection("organisations").getOne(
      membership.organisation,
    );
    const planId = ((org as Record<string, unknown>).plan as PlanId) ?? "free";
    const entitlements = entitlementsFor(planId);

    if (!entitlements.mapEnabled && !entitlements.fullDetailsEnabled) {
      return null;
    }

    return { entitlements };
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  // Authenticate and check Pro entitlement.
  const auth = await requireProEntitlement();
  if (!auth) {
    return NextResponse.json({ error: "Pro subscription required." }, { status: 403 });
  }

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  // Set up SSE response.
  const stream = new ReadableStream({
    start: async (controller) => {
      // Register this client.
      clients.add(controller);
      info("sse_stream", {
        message: "SSE client connected",
        totalClients: clients.size,
      });

      // Send immediate heartbeat.
      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ type: "connected", clients: clients.size })}\n\n`,
        ),
      );

      // Subscribe to PocketBase real-time changes on opportunities.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unsub = await pb.collection("opportunities").subscribe("*", (e: any) => {
        try {
          if (e.action === "create") {
            const record = e.record as Record<string, unknown>;
            // Only stream high-velocity signals (MEGAPROCUREMENT or HIGH_CAP).
            if (
              record.signal_tier === "MEGAPROCUREMENT" ||
              record.signal_tier === "HIGH_CAP"
            ) {
              broadcast({
                type: "opportunity",
                ...record,
              });
            }
          }
        } catch (err) {
          error("sse_stream", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      // Cleanup on connection close.
      return () => {
        clients.delete(controller);
        try {
          unsub();
        } catch {
          // Ignore unsubscribe errors.
        }
        info("sse_stream", {
          message: "SSE client disconnected",
          totalClients: clients.size,
        });
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const dynamic = "force-dynamic";
