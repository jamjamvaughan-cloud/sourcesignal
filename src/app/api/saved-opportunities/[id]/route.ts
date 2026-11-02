/**
 * Unsave a saved opportunity.
 *
 * DELETE /api/saved-opportunities/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;

async function requireUser(
  request: NextRequest,
): Promise<{ id: string } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return { id: user.id };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: savedId } = await params;
  const userOrError = await requireUser(request);
  if (userOrError instanceof NextResponse) return userOrError;
  const { id: userId } = userOrError;

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    // Verify ownership before deleting.
    const record = await pb.collection("saved_opportunities").getOne(savedId);
    if (record.user !== userId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await pb.collection("saved_opportunities").delete(savedId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to unsave opportunity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
