/**
 * Outbound webhook destination test.
 *
 * POST /api/webhooks/[id]/test — send a test payload to a registered
 * destination to verify connectivity and signature handling.
 *
 * Requires an authenticated session and ownership of the destination.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  buildSignalPayload,
  signPayload,
} from "@/lib/webhooks/dispatcher";
import { info, error } from "@/lib/logger";

const TEST_SIGNAL = {
  id: "00000000-0000-0000-0000-000000000000",
  title: "Webhook delivery test",
  buyer_name: "SourceSignal",
  jurisdiction: "UK",
  sector: "TECH",
  opportunity_type: "PROJECT",
  estimated_value: null,
  source_name: "SourceSignal",
  source_url: "https://sourcesignal.site/",
  source_hash: "webhook-test",
  commercial_why: "This is a test delivery to verify your webhook endpoint.",
  published_at: new Date().toISOString(),
  sha256_hash: null,
} as const;

async function requireOwner(
  request: NextRequest,
  webhookId: string,
): Promise<{ userId: string; url: string; secret: string | null } | NextResponse> {
  const cookieHeader = request.headers.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const result = await query(
    `SELECT url, secret FROM webhooks WHERE id = $1 AND user_id = $2`,
    [webhookId, user.id],
  );
  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const row = result.rows[0];
  return {
    userId: user.id,
    url: row.url as string,
    secret: (row.secret as string | null) ?? null,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: webhookId } = await params;
  const result = await requireOwner(request, webhookId);
  if (result instanceof NextResponse) return result;
  const { userId, url, secret } = result;

  const payload = buildSignalPayload(TEST_SIGNAL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SourceSignal/1.0 (+https://sourcesignal.site)",
  };
  if (secret) {
    headers["X-SourceSignal-Signature"] = signPayload(secret, payload);
  }

  let statusCode: number | null = null;
  let ok = false;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    statusCode = response.status;
    ok = response.ok;
    if (!ok) {
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (err) {
    statusCode = null;
    ok = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Persist the test attempt to alert_logs.
  try {
    await query(
      `INSERT INTO alert_logs (
            webhook_id, signal_id, status, response_status_code, attempted_at
          )
          VALUES ($1, $2, $3, $4, NOW())`,
      [webhookId, null, ok ? "sent" : "failed", statusCode],
    );
  } catch (err) {
    error("webhook_test_log", {
      error: err instanceof Error ? err.message : String(err),
      webhookId,
    });
  }

  info("webhook_test", {
    message: "Webhook test delivery",
    webhookId,
    userId,
    url,
    ok,
    statusCode,
  });

  return NextResponse.json({
    ok,
    statusCode,
    error: errorMessage,
  });
}
