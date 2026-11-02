/**
 * Demonstration source adapter.
 *
 * This adapter generates clearly-marked demonstration records for development
 * and testing purposes only. It does NOT connect to any live procurement
 * portal. All records have `is_demonstration: true` and must never be
 * presented as verified live intelligence.
 *
 * In production, replace this with adapters for specific permitted sources
 * (e.g. UK Contracts Finder, US SAM.gov, etc.), respecting each source's
 * terms of service and access controls.
 */

import { BaseSourceAdapter } from "./base";
import type { SourceRecord } from "@/types";

const DEMO_SECTORS = [
  "construction",
  "infrastructure",
  "energy",
  "transport",
  "healthcare-infrastructure",
  "technology-infrastructure",
];

const DEMO_REGIONS = ["ENG", "SCT", "WLS", "NIR"];

const DEMO_STAGES = ["published", "evaluation", "planned"];

const DEMO_TITLES = [
  "Secondary School Roofing Refurbishment",
  "Highway Resurfacing Programme – A12 Corridor",
  "Renewable Energy Grid Connection Study",
  "Hospital IT Infrastructure Upgrade",
  "Fleet Vehicle Procurement Framework",
  "Flood Defence Wall Construction",
  "Broadband Rollout – Rural Exchange",
  "Prison CCTV System Replacement",
];

export class DemonstrationAdapter extends BaseSourceAdapter {
  readonly country = "UK";

  constructor() {
    super("demonstration", true);
  }

  async discover(): Promise<SourceRecord[]> {
    const records: SourceRecord[] = [];

    // Generate a small, fixed set of demonstration records.
    // These are deterministic and clearly marked.
    for (let i = 0; i < DEMO_TITLES.length; i++) {
      const sector = DEMO_SECTORS[i % DEMO_SECTORS.length];
      const region = DEMO_REGIONS[i % DEMO_REGIONS.length];
      const stage = DEMO_STAGES[i % DEMO_STAGES.length];
      const sourceId = `demo-${String(i + 1).padStart(3, "0")}`;
      const sourceUrl = `https://demo.sourcesignal.example/opportunities/${sourceId}`;

      records.push({
        sourceId,
        sourceName: "demonstration",
        sourceUrl,
        rawPayload: {
          title: DEMO_TITLES[i],
          sector,
          region,
          stage,
          demonstration: true,
        },
        fetchedAt: new Date().toISOString(),
      });
    }

    return records;
  }
}
