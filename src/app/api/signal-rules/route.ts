/**
 * Signal Rules API (Custom Keyword & Territory Signal Rules).
 *
 * GET    /api/signal-rules — list user's signal rules
 * POST   /api/signal-rules — create a new signal rule
 *
 * Users can set personalized alert routing profiles based on geographical
 * jurisdiction (UK, EU, US, etc.) and target contract value ranges. Mega-
 * enterprise users can filter for £50M+ infrastructure, while niche software
 * agencies can target £100K Cloud/DevOps signals.
 *
 * Requires Pro subscription.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { entitlementsFor } from "@/lib/entitlements";
import type { PlanId } from "@/lib/entitlements";
import { info, error } from "@/lib/logger";

async function getUserPlanId(userId: string): Promise<PlanId> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAdminPb = async () => null as any;
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
  orgId: string | null;
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
      { error: "Signal rules require a Pro subscription." },
      { status: 403 },
    );
  }

  // Get organisation id from membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAdminPb = async () => null as any;
  const pb = await getAdminPb();
  let orgId: string | null = null;
  if (pb) {
    try {
      const memberships = await pb.collection("memberships").getList(1, 1, {
        filter: `user = "${user.id}"`,
      });
      if (memberships.items.length > 0) {
        orgId = memberships.items[0].organisation;
      }
    } catch {
      orgId = null;
    }
  }

  return { userId: user.id, orgId, entitlements };
}

export async function GET(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  if (!orgId) {
    return NextResponse.json({ items: [], total: 0 });
  }

  try {
    const result = await query(
      `SELECT id, name, description, keywords, territories, min_value,
              max_value, min_tier, vulnerability_triggers, is_active,
              match_count, last_matched_at, created_at, updated_at
         FROM signal_rules
        WHERE organisation_id = $1
        ORDER BY created_at DESC`,
      [orgId],
    );

    return NextResponse.json({
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        keywords: row.keywords ?? [],
        territories: row.territories ?? [],
        minValue: row.min_value ?? null,
        maxValue: row.max_value ?? null,
        minTier: row.min_tier,
        vulnerabilityTriggers: row.vulnerability_triggers ?? [],
        isActive: row.is_active,
        matchCount: row.match_count ?? 0,
        lastMatchedAt: row.last_matched_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: result.rowCount ?? 0,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to list signal rules.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const result = await requireUserAndEntitlements(request);
  if (result instanceof NextResponse) return result;
  const { userId, orgId } = result;

  if (!orgId) {
    return NextResponse.json(
      { error: "No organisation found. Create an organisation first." },
      { status: 400 },
    );
  }

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

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Rule name is required." }, { status: 400 });
  }

  const parsedKeywords = Array.isArray(keywords) ? keywords : [];
  const parsedTerritories = Array.isArray(territories) ? territories : [];
  const parsedMinValue = minValue != null ? Number(minValue) : null;
  const parsedMaxValue = maxValue != null ? Number(maxValue) : null;
  const parsedMinTier = minTier || "STANDARD_COMMERCIAL";
  const parsedVulnerabilityTriggers = Array.isArray(vulnerabilityTriggers)
    ? vulnerabilityTriggers
    : [];
  const parsedIsActive = isActive !== false;

  try {
    const insertResult = await query(
      `INSERT INTO signal_rules (
            organisation_id, user_id, name, description, keywords,
            territories, min_value, max_value, min_tier,
            vulnerability_triggers, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING id, name, description, keywords, territories,
                    min_value, max_value, min_tier, vulnerability_triggers,
                    is_active, match_count, last_matched_at,
                    created_at, updated_at`,
      [
        orgId,
        userId,
        name,
        description ?? null,
        JSON.stringify(parsedKeywords),
        JSON.stringify(parsedTerritories),
        parsedMinValue,
        parsedMaxValue,
        parsedMinTier,
        JSON.stringify(parsedVulnerabilityTriggers),
        parsedIsActive,
      ],
    );

    const row = insertResult.rows[0];
    info("signal_rule", {
      message: "Signal rule created",
      organisationId: orgId,
      userId,
      ruleId: row.id,
      name,
    });

    return NextResponse.json({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      keywords: row.keywords ?? [],
      territories: row.territories ?? [],
      minValue: row.min_value ?? null,
      maxValue: row.max_value ?? null,
      minTier: row.min_tier,
      vulnerabilityTriggers: row.vulnerability_triggers ?? [],
      isActive: row.is_active,
      matchCount: row.match_count ?? 0,
      lastMatchedAt: row.last_matched_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create signal rule.";
    error("signal_rule", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
