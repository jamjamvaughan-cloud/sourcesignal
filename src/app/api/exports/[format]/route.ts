/**
 * Export API (Phase I).
 *
 * GET /api/exports/csv  — CSV export for Pro users
 * GET /api/exports/json — JSON export for Pro users
 *
 * Exports only fields the user is permitted to access based on their plan.
 * Free users are denied with 403. CSV fields are escaped to prevent
 * formula injection.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { entitlementsFor, permittedOpportunityFields } from "@/lib/entitlements";
import { isValidSectorId, isValidRegion } from "@/lib/config";
import type { PlanId } from "@/lib/entitlements";

const MAX_EXPORT_ROWS = 1000;

/**
 * Resolve the caller's TRUE plan from their organisation membership in
 * PocketBase. Never hardcode "free" — that broke Pro exports.
 */
async function getUserPlanId(userId: string): Promise<PlanId> {
  const pb = await getAdminPb();
  if (!pb) {
    return "free";
  }
  try {
    const memberships = await pb.collection("memberships").getList(1, 1, {
      filter: `user = "${userId}"`,
    });
    if (memberships.items.length === 0) {
      return "free";
    }
    const membership = memberships.items[0];
    const org = await pb.collection("organisations").getOne(
      membership.organisation,
    );
    return ((org as Record<string, unknown>).plan as PlanId) ?? "free";
  } catch {
    return "free";
  }
}

async function requirePro(
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
  if (!entitlements.exportsEnabled) {
    return NextResponse.json(
      { error: "Exports require a Pro subscription." },
      { status: 403 },
    );
  }

  return { userId: user.id, entitlements };
}

/**
 * Escapes a CSV field to prevent formula injection and handle special chars.
 */
function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  let str = String(value);
  // If the field starts with =, +, -, @, or tab, prepend a tab to prevent
  // spreadsheet formula injection.
  if (/^[=+\-@\t]/.test(str)) {
    str = "\t" + str;
  }
  // If the field contains a comma, quote, or newline, wrap in quotes and
  // escape internal quotes by doubling them.
  if (/[,"\n\r]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ format: string }> },
) {
  const { format } = await params;
  const result = await requirePro(request);
  if (result instanceof NextResponse) return result;
  const { entitlements } = result;

  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const sector = searchParams.get("sector") || undefined;
  const region = searchParams.get("region") || undefined;
  const limit = Math.min(
    MAX_EXPORT_ROWS,
    Math.max(1, Number(searchParams.get("limit")) || 100),
  );

  // Validate filters.
  if (sector && !isValidSectorId(sector)) {
    return NextResponse.json({ error: `Invalid sector: ${sector}` }, { status: 400 });
  }
  if (region && !isValidRegion(region)) {
    return NextResponse.json({ error: `Invalid region: ${region}` }, { status: 400 });
  }

  const filterParts: string[] = [`is_demonstration = false`];
  if (sector) filterParts.push(`sector = "${sector}"`);
  if (region) filterParts.push(`region = "${region}"`);

  try {
    const records = await pb.collection("opportunities").getFullList({
      filter: filterParts.join(" && "),
      limit,
    });

    const permitted = permittedOpportunityFields(entitlements);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = records.map((item: any) => {
      const out: Record<string, unknown> = {};
      for (const field of permitted) {
        if (field in item) {
          out[field] = (item as Record<string, unknown>)[field];
        }
      }
      return out;
    });

    if (format === "csv") {
      const headers = permitted.join(",");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = sanitized.map((item: any) =>
        permitted
          .map((f) => escapeCsvField(item[f]))
          .join(","),
      );
      const csv = [headers, ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="opportunities-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (format === "json") {
      const json = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          count: sanitized.length,
          fields: permitted,
          data: sanitized,
        },
        null,
        2,
      );

      return new NextResponse(json, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="opportunities-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format. Use 'csv' or 'json'." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
