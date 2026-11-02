/**
 * Update or delete an alert.
 *
 * PATCH  /api/alerts/[id]
 * DELETE /api/alerts/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanIdFromPB } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { entitlementsFor } from "@/lib/entitlements";
import { isValidSectorId, isValidRegion } from "@/lib/config";
import type { PlanId } from "@/lib/entitlements";

async function requireUser(
  request: NextRequest,
): Promise<{ userId: string; planId: PlanId } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const planId = await getUserPlanIdFromPB(user.id);
  const entitlements = entitlementsFor(planId);

  if (!entitlements.alertsEnabled) {
    return NextResponse.json(
      { error: "Alerts require a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id, planId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alertId } = await params;
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const body = await request.json().catch(() => ({}));
  const { name, sectors, regions, keywords, enabled } = body;

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
    // Verify ownership.
    const record = await pb.collection("alerts").getOne(alertId);
    if (record.user !== userId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const updated = await pb.collection("alerts").update(alertId, {
      ...(name !== undefined && { name }),
      ...(sectors !== undefined && { sectors }),
      ...(regions !== undefined && { regions }),
      ...(keywords !== undefined && { keywords }),
      ...(enabled !== undefined && { enabled }),
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      enabled: updated.enabled,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update alert.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alertId } = await params;
  const result = await requireUser(request);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    const record = await pb.collection("alerts").getOne(alertId);
    if (record.user !== userId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await pb.collection("alerts").delete(alertId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete alert.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
