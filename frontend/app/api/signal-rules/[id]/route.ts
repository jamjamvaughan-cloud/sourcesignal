/**
 * Signal Rule Detail API (Custom Keyword & Territory Signal Rules).
 *
 * PATCH  /api/signal-rules/[id] — update a signal rule
 * DELETE /api/signal-rules/[id] — delete a signal rule
 *
 * Requires Pro subscription and ownership of the rule.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserPlanId } from "@/lib/auth";
import { query } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import { info, error } from "@/lib/logger";

async function requireOwner(
  request: NextRequest,
  ruleId: string,
): Promise<{
  userId: string;
  orgId: string;
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
      { error: "Signal rules require a Pro subscription." },
      { status: 403 },
    );
  }

  // Verify ownership of the signal rule.
  const result = await query(
    `SELECT organisation_id, user_id FROM signal_rules WHERE id = $1`,
    [ruleId],
  );
  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const row = result.rows[0];
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return { userId: user.id, orgId: row.organisation_id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ruleId } = await params;
  const result = await requireOwner(request, ruleId);
  if (result instanceof NextResponse) return result;

  const body = await request.json().catch(() => ({}));
  const {
    name,
    description,
    keywords,
    territories,
    minValue,
    maxValue,
    minTier,
    vulnerabilityTriggers,
    isActive,
  } = body;

  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    if (typeof name !== "string" || !name) {
      return NextResponse.json({ error: "Invalid name." }, { status: 400 });
    }
    updateFields.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    values.push(description);
  }
  if (keywords !== undefined && Array.isArray(keywords)) {
    updateFields.push(`keywords = $${paramIndex++}`);
    values.push(JSON.stringify(keywords));
  }
  if (territories !== undefined && Array.isArray(territories)) {
    updateFields.push(`territories = $${paramIndex++}`);
    values.push(JSON.stringify(territories));
  }
  if (minValue !== undefined) {
    updateFields.push(`min_value = $${paramIndex++}`);
    values.push(Number(minValue));
  }
  if (maxValue !== undefined) {
    updateFields.push(`max_value = $${paramIndex++}`);
    values.push(Number(maxValue));
  }
  if (minTier !== undefined) {
    updateFields.push(`min_tier = $${paramIndex++}`);
    values.push(minTier);
  }
  if (vulnerabilityTriggers !== undefined && Array.isArray(vulnerabilityTriggers)) {
    updateFields.push(`vulnerability_triggers = $${paramIndex++}`);
    values.push(JSON.stringify(vulnerabilityTriggers));
  }
  if (isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }

  if (updateFields.length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(ruleId);

  try {
    await query(
      `UPDATE signal_rules
            SET ${updateFields.join(", ")}
          WHERE id = $${paramIndex++}`,
      values,
    );

    info("signal_rule", {
      message: "Signal rule updated",
      ruleId,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update signal rule.";
    error("signal_rule", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ruleId } = await params;
  const result = await requireOwner(request, ruleId);
  if (result instanceof NextResponse) return result;

  try {
    await query(
      `DELETE FROM signal_rules WHERE id = $1`,
      [ruleId],
    );

    info("signal_rule", {
      message: "Signal rule deleted",
      ruleId,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete signal rule.";
    error("signal_rule", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
