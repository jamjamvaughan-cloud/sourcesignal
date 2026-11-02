/**
 * Alerts API.
 *
 * GET    /api/alerts — list user's alerts
 * POST   /api/alerts — create an alert
 * PATCH  /api/alerts/[id] — update an alert (enable/disable, modify criteria)
 * DELETE /api/alerts/[id] — delete an alert
 *
 * All operations are owner-scoped: users can only access their own alerts.
 * Alerts are a Pro feature; Free users cannot create or manage alerts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { entitlementsFor } from "@/lib/entitlements";
import { isValidSectorId, isValidRegion } from "@/lib/config";
import type { PlanId } from "@/lib/entitlements";

async function getUserPlanId(userId: string): Promise<PlanId> {
  const pb = await getAdminPb();
  if (!pb) return "free";
  try {
    const memberships = await pb.collection("memberships").getList(1, 1, {
      filter: `user = "${userId}"`,
    });
    if (memberships.items.length === 0) {
      return "free";
    }
    const membership = memberships.items[0];
    const org = await pb.collection("organisations").getOne(membership.organisation);
    return ((org as Record<string, unknown>).plan as PlanId) ?? "free";
  } catch {
    return "free";
  }
}

async function requireUserAndEntitlements(
  request: NextRequest,
): Promise<{
  userId: string;
  entitlements: ReturnType<typeof entitlementsFor>;
} | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanId(user.id);
  const entitlements = entitlementsFor(planId);

  if (!entitlements.alertsEnabled) {
    return NextResponse.json(
      { error: "Alerts require a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id, entitlements };
}

export async function GET(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    const records = await pb.collection("alerts").getList(1, 50, {
      filter: `user = "${userId}"`,
      sort: "-created_at",
    });

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: records.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        sectors: item.sectors,
        regions: item.regions,
        keywords: item.keywords,
        enabled: item.enabled,
        lastTriggered: item.last_triggered,
        createdAt: item.created_at,
      })),
      total: records.totalItems,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list alerts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = await request.json().catch(() => ({}));
  const { name, sectors, regions, keywords, enabled } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Alert name is required." }, { status: 400 });
  }

  // Validate sector and region values.
  if (sectors && Array.isArray(sectors)) {
    for (const s of sectors) {
      if (!isValidSectorId(s)) {
        return NextResponse.json({ error: `Invalid sector: ${s}` }, { status: 400 });
      }
    }
  }
  if (regions && Array.isArray(regions)) {
    for (const r of regions) {
      if (!isValidRegion(r)) {
        return NextResponse.json({ error: `Invalid region: ${r}` }, { status: 400 });
      }
    }
  }

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    const record = await pb.collection("alerts").create({
      user: userId,
      name,
      sectors: sectors || [],
      regions: regions || [],
      keywords: keywords || "",
      enabled: enabled !== false,
      last_triggered: null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      id: record.id,
      name: record.name,
      enabled: record.enabled,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create alert.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
