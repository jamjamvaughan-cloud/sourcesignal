/**
 * Alert evaluation endpoint (Phase G).
 *
 * POST /api/alerts/evaluate
 *
 * Evaluates all active alerts against opportunities updated in the last
 * 24 hours. Idempotent: avoids duplicate deliveries for the same
 * (alert, opportunity) pair by checking existing `alert_deliveries`.
 *
 * Runs entirely against PostgreSQL. Can be triggered by a cron job or the
 * ingestion worker.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { emailDelivery } from "@/lib/email-delivery";
import { parseAlertFilters } from "@/lib/alert-filters";
import { info, error } from "@/lib/logger";

interface AlertRow {
  id: string;
  query_filters: unknown;
  email: string | null;
}

interface OpportunityRow {
  id: string;
  title: string | null;
  summary: string | null;
  sector: string | null;
  region: string | null;
}

export async function POST(): Promise<NextResponse> {
  try {
    const alertResult = await query(
      `SELECT a.id, a.query_filters, u.email
         FROM alerts a
         JOIN users u ON u.id = a.user_id
        WHERE a.is_active = TRUE`,
    );
    const alerts = alertResult.rows as AlertRow[];

    if (alerts.length === 0) {
      info("alert_evaluation", { alertsEvaluated: 0, deliveriesSent: 0 });
      return NextResponse.json({
        evaluated: 0,
        deliveriesSent: 0,
        message: "No enabled alerts.",
      });
    }

    const opportunityResult = await query(
      `SELECT id, title, summary, sector, region
         FROM opportunities
        WHERE updated_at >= NOW() - INTERVAL '24 hours'
          AND is_demonstration = FALSE`,
    );
    const opportunities = opportunityResult.rows as OpportunityRow[];

    const deliveredResult = await query(
      `SELECT alert_id, opportunity_id FROM alert_deliveries`,
    );
    const deliveredKeys = new Set(
      deliveredResult.rows.map(
        (row) => `${row.alert_id as string}:${row.opportunity_id as string}`,
      ),
    );

    let deliveriesSent = 0;

    for (const alert of alerts) {
      const filters = parseAlertFilters(alert.query_filters);
      const keywords = filters.keywords
        .split(",")
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean);

      for (const opportunity of opportunities) {
        if (
          filters.sectors.length > 0 &&
          (!opportunity.sector ||
            !filters.sectors.includes(opportunity.sector))
        ) {
          continue;
        }

        if (
          filters.regions.length > 0 &&
          (!opportunity.region ||
            !filters.regions.includes(opportunity.region))
        ) {
          continue;
        }

        if (keywords.length > 0) {
          const haystack =
            `${opportunity.title ?? ""} ${opportunity.summary ?? ""}`.toLowerCase();
          if (!keywords.some((keyword) => haystack.includes(keyword))) {
            continue;
          }
        }

        const dedupKey = `${alert.id}:${opportunity.id}`;
        if (deliveredKeys.has(dedupKey)) {
          continue;
        }

        const result = await emailDelivery.sendAlert({
          alertId: alert.id,
          opportunityId: opportunity.id,
          to: alert.email ?? "",
          subject: `New opportunity: ${opportunity.title ?? "Untitled"}`,
          text: `A new ${opportunity.sector ?? "sector"} opportunity in ${
            opportunity.region ?? "your region"
          }: ${opportunity.title ?? "Untitled"}`,
        });

        deliveredKeys.add(dedupKey);
        if (result.status === "sent") {
          deliveriesSent++;
        }
      }
    }

    info("alert_evaluation", {
      alertsEvaluated: alerts.length,
      opportunitiesChecked: opportunities.length,
      deliveriesSent,
    });

    return NextResponse.json({
      evaluated: alerts.length,
      opportunitiesChecked: opportunities.length,
      deliveriesSent,
    });
  } catch (err: unknown) {
    error("alert_evaluation", {
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Alert evaluation failed." },
      { status: 500 },
    );
  }
}
