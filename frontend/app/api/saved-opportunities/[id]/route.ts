/**
 * Unsave a saved opportunity.
 *
 * DELETE /api/saved-opportunities/[id]
 *
 * The `[id]` may be either the saved_opportunities row id or the opportunity
 * id, so the dashboard can unsave with whichever identifier it already has.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { error } from "@/lib/logger";

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

  try {
    const result = await query(
      `DELETE FROM saved_opportunities
        WHERE user_id = $1
          AND (id::text = $2 OR opportunity_id::text = $2)
        RETURNING id`,
      [userId, savedId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    error("saved_opportunity_delete_failed", {
      userId,
      savedId,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unable to remove this signal." },
      { status: 500 },
    );
  }
}
