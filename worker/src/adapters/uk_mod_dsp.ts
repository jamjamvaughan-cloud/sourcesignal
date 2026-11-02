/**
 * UK Ministry of Defence (MoD) Defence Sourcing Portal (DSP) source adapter.
 *
 * Discovers defence procurement opportunities from the UK Ministry of Defence
 * Defence Sourcing Portal.
 *
 * Official Portal: https://www.gov.uk/government/organisations/defence-equipment-and-support
 * DSP Opportunities: https://www.gov.uk/government/collections/defence-sourcing-portal-dsp-opportunities
 * Note: The MOD DSP does not currently publish a public REST API. This adapter
 * uses the Contracts Finder OCDS feed filtered for MOD/defence contracts as a fallback.
 *
 * Configuration:
 *   UK_MOD_DSP_API_URL - Base URL for the MOD DSP API (if available)
 *   UK_MOD_DSP_API_KEY - API key for authenticated access (optional)
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const UK_MOD_DSP_API_URL =
  process.env.UK_MOD_DSP_API_URL ||
  "https://www.contractsfinder.service.gov.uk/Public/Api/OCDS";

const UK_MOD_DSP_API_KEY = process.env.UK_MOD_DSP_API_KEY;

export class UkModDspAdapter extends BaseSourceAdapter {
  readonly country = "UK" as const;

  constructor() {
    super("uk_mod_dsp", true);
  }

  async discover(): Promise<SourceRecord[]> {
    return this.fetchDeltas({
      publishedAfter: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  async fetchDeltas(params: { publishedAfter: string }): Promise<SourceRecord[]> {
    try {
      const url = new URL(UK_MOD_DSP_API_URL);
      url.searchParams.set("publishedFrom", params.publishedAfter.split("T")[0]);
      // Filter for MOD/defence buyers
      url.searchParams.set("buyer", "Ministry of Defence");

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SourceSignal/1.0",
      };

      if (UK_MOD_DSP_API_KEY) {
        headers["Authorization"] = `Bearer ${UK_MOD_DSP_API_KEY}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          `[worker] UK MOD DSP API returned ${resp.status}`,
        );
        return [];
      }

      const data = (await resp.json()) as unknown;

      const rawArray = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).releases ||
          (data as Record<string, unknown>).opportunities ||
          []) as unknown[];

      const defenceRecords = rawArray.filter((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const buyer = String(raw.buyer ?? raw.buyerName ?? raw.organisation ?? "").toLowerCase();
        const title = String(raw.title ?? tender?.title ?? "").toLowerCase();
        const cpv = String(tender?.mainProcurementCategory ?? raw.cpv ?? "").toLowerCase();
        return buyer.includes("defence") ||
          buyer.includes("ministry of defence") ||
          buyer.includes("mod ") ||
          title.includes("defence") ||
          title.includes("military") ||
          cpv.startsWith("35") || // Security, fire-fighting, police, defence equipment
          cpv.startsWith("18"); // Arms, ammunition
      });

      const records: SourceRecord[] = defenceRecords.map((item: unknown) => {
        const raw = item as Record<string, unknown>;
        const tender = raw.tender as Record<string, unknown> | undefined;
        const ocid = raw.ocid ?? raw.id ?? tender?.id ?? "";
        const region = String(raw.region ?? tender?.region ?? "ENG").toUpperCase();
        return {
          sourceId: String(ocid),
          sourceName: "uk_mod_dsp",
          country: "UK",
          sourceUrl: String(
            raw.source_url ??
              raw.url ??
              tender?.url ??
              `https://www.contractsfinder.service.gov.uk/Notice/${ocid}`,
          ),
          rawPayload: { ...raw, region },
          fetchedAt: new Date().toISOString(),
        };
      });

      return records;
    } catch (err) {
      console.error(
        `[worker] UK MOD DSP adapter failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }
}

export default new UkModDspAdapter();