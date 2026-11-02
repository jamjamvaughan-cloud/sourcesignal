/**
 * Alert evaluation endpoint (Phase G).
 *
 * POST /api/alerts/evaluate
 *
 * Evaluates all enabled alerts against newly ingested or updated
 * opportunities. Idempotent: avoids sending duplicate alerts for the same
 * (alert, opportunity) pair by checking existing alert_deliveries.
 *
 * Server-side only. Can be triggered by a cron job or the ingestion worker.
 */

import { NextResponse } from "next/server";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAdminPb = async () => null as any;
import { emailDelivery } from "@/lib/email-delivery";
import { info, error } from "@/lib/logger";

export async function POST(): Promise<NextResponse> {
  const pb = await getAdminPb();
  if (!pb) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  try {
    // Fetch all enabled alerts.
    const alerts = await pb.collection("alerts").getFullList({
      filter: "enabled = true",
    });

    if (alerts.length === 0) {
      info("alert_evaluation", { alertsEvaluated: 0, deliveriesSent: 0 });
      return NextResponse.json({
        evaluated: 0,
        deliveriesSent: 0,
        message: "No enabled alerts.",
      });
    }

    // Fetch recently updated opportunities (last 24 hours by default).
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const opportunities = await pb.collection("opportunities").getFullList({
      filter: `updated >= "${twentyFourHoursAgo}" && is_demonstration = false`,
    });

    // Fetch existing alert deliveries to avoid duplicates.
    const existingDeliveries = await pb.collection("alert_deliveries").getFullList();
    const deliveredKeys = new Set(
      existingDeliveries.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => `${d.alert}-${d.opportunity}`,
      ),
    );

    let deliveriesSent = 0;

    for (const alert of alerts) {
      const alertSectors = (alert.sectors as string[]) || [];
      const alertRegions = (alert.regions as string[]) || [];
      const alertKeywords = (alert.keywords as string) || "";

      for (const opp of opportunities) {
        const opportunity = opp as Record<string, unknown>;

        // Sector filter.
        if (
          alertSectors.length > 0 &&
          !alertSectors.includes(opportunity.sector as string)
        ) {
          continue;
        }

        // Region filter.
        if (
          alertRegions.length > 0 &&
          !alertRegions.includes(opportunity.region as string)
        ) {
          continue;
        }

        // Keyword filter (matches title or summary).
        if (alertKeywords) {
          const keywords = alertKeywords
            .split(",")
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean);
          const title = (opportunity.title as string) || "";
          const summary = (opportunity.summary as string) || "";
          const haystack = `${title} ${summary}`.toLowerCase();
          if (!keywords.some((k) => haystack.includes(k))) {
            continue;
          }
        }

        const dedupKey = `${alert.id}-${opportunity.id}`;
        if (deliveredKeys.has(dedupKey)) {
          continue; // Already delivered for this alert+opportunity.
        }

        // Send alert (queued if no provider configured).
        // Expand the user relation to get the recipient email dynamically.
        const alertWithUser = await pb.collection("alerts").getOne(alert.id, {
          expand: "user",
        });
        const recipient =
          (alertWithUser.expand?.user as Record<string, unknown>)?.email ??
          "user@example.com";
        const result = await emailDelivery.sendAlert({
          alertId: alert.id,
          opportunityId: opportunity.id as string,
          to: recipient as string,
          subject: `New opportunity: ${opportunity.title}`,
          text: `A new ${opportunity.sector} opportunity in ${opportunity.region}: ${opportunity.title}`,
        });

        await pb.collection("alert_deliveries").create({
          alert: alert.id,
          opportunity: opportunity.id,
          delivered_at: new Date().toISOString(),
          status: result.status === "sent" ? "sent" : "queued",
          provider: "email",
          external_id: result.messageId,
        });

        deliveredKeys.add(dedupKey);
        deliveriesSent++;
      }
    }

    info("alert_evaluation", {
      alertsEvaluated: alerts.length,
      opportunitiesChecked: opportunities.length,
      deliveriesSent,
    });

    return NextResponse.json({
      evaluated: alerts.length,
      deliveriesSent,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Alert evaluation failed.";
    error("alert_evaluation", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
