/**
 * Saved opportunities API.
 *
 * GET    /api/saved-opportunities — list user's saved opportunities
 * POST   /api/saved-opportunities — save an opportunity
 *
 * All operations are owner-scoped: users can only access their own saved items.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;

async function requireUser(
  request: NextRequest,
): Promise<{ id: string; email: string } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return { id: user.id, email: user.email };
}

export async function GET(request: NextRequest) {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId } = userOrError;

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503 },
    );
  }

  try {
    const records = await pb.collection("saved_opportunities").getList(1, 50, {
      filter: `user = "${userId}"`,
      expand: "opportunity",
      sort: "-saved_at",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = records.items.map((item: any) => ({
      id: item.id,
      savedAt: item.saved_at,
      opportunity: item.expand?.opportunity
        ? (item.expand.opportunity as Record<string, unknown>)
        : null,
    }));

    return NextResponse.json({ items, total: records.totalItems });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to list saved opportunities.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId } = userOrError;

  const body = await request.json().catch(() => ({}));
  const { opportunityId } = body;

  if (!opportunityId) {
    return NextResponse.json(
      { error: "opportunityId is required." },
      { status: 400 },
    );
  }

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    // Check if already saved.
    try {
      await pb
        .collection("saved_opportunities")
        .getFirstListItem(`user = "${userId}" && opportunity = "${opportunityId}"`);
      return NextResponse.json({ error: "Already saved." }, { status: 409 });
    } catch {
      // Not already saved, proceed.
    }

    const record = await pb.collection("saved_opportunities").create({
      user: userId,
      opportunity: opportunityId,
      saved_at: new Date().toISOString(),
    });

    return NextResponse.json({ id: record.id, savedAt: record.saved_at });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save opportunity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
