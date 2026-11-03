import { describe, expect, it } from "vitest";
import {
  buildCommercialWhy,
  inferOpportunityType,
  inferSector,
  parseAmount,
} from "../src/lib/ingestion/http";
import { buildSourceHash } from "../src/lib/ingestion/runner";
import {
  PRIMARY_SOURCES_MONITORED,
  PRIMARY_SOURCES_MONITORED_LABEL,
} from "../src/lib/ingestion/sources";
import type {
  NormalisedSignal,
  SignalSourceAdapter,
} from "../src/lib/ingestion/types";

const adapter: SignalSourceAdapter = {
  name: "test-adapter",
  jurisdiction: "UK",
  enabled: true,
  discover: async () => [],
};

const signal: NormalisedSignal = {
  title: "Hospital redevelopment",
  buyerName: "NHS Trust",
  jurisdiction: "UK",
  sector: "HEALTHCARE",
  opportunityType: "PROJECT",
  estimatedValue: 1_200_000,
  sourceName: "GOV.UK Find a Tender",
  sourceUrl: "https://example.com/notice/1",
  sourceId: "notice-1",
  commercialWhy: "NHS Trust has advanced a healthcare project.",
};

describe("ingestion helpers", () => {
  it("parses currency amounts with suffixes and separators", () => {
    expect(parseAmount("£1.2m")).toBe(1_200_000);
    expect(parseAmount("1,500")).toBe(1500);
    expect(parseAmount("500k")).toBe(500_000);
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("not a number")).toBeNull();
  });

  it("classifies sectors from source text", () => {
    expect(inferSector("NHS hospital redevelopment")).toBe("HEALTHCARE");
    expect(inferSector("solar grid and battery storage")).toBe("ENERGY");
    expect(inferSector("railway station upgrade")).toBe("TRANSPORT");
    expect(inferSector("cloud data platform")).toBe("TECH");
  });

  it("classifies opportunity types from source text", () => {
    expect(inferOpportunityType("planning permission for a new facility")).toBe(
      "EXPANSION",
    );
    expect(inferOpportunityType("contract notice for cloud services")).toBe(
      "PROCUREMENT",
    );
    expect(inferOpportunityType("new regulatory reporting mandate")).toBe(
      "COMPLIANCE",
    );
  });

  it("builds a single-sentence commercial rationale", () => {
    const why = buildCommercialWhy({
      buyerName: "NHS Trust.",
      sector: "HEALTHCARE",
      opportunityType: "PROJECT",
      estimatedValue: 1_200_000,
    });

    expect(why).toBe(
      "NHS Trust has advanced a healthcare project with an estimated value of 1.2M, creating near-term delivery and subcontracting demand.",
    );
  });
});

describe("signal deduplication", () => {
  it("produces a stable hash for the same source record", () => {
    expect(buildSourceHash(adapter, signal)).toBe(
      buildSourceHash(adapter, { ...signal, title: "Updated title" }),
    );
  });

  it("changes the hash when the source record changes", () => {
    expect(buildSourceHash(adapter, signal)).not.toBe(
      buildSourceHash(adapter, { ...signal, sourceId: "notice-2" }),
    );
    expect(buildSourceHash(adapter, signal)).not.toBe(
      buildSourceHash(
        { ...adapter, name: "another-adapter" },
        signal,
      ),
    );
  });
});

describe("primary source display", () => {
  it("lists every monitored source in the dashboard label", () => {
    expect(PRIMARY_SOURCES_MONITORED_LABEL).toMatch(
      /^PRIMARY SOURCES MONITORED: /,
    );
    for (const source of PRIMARY_SOURCES_MONITORED) {
      expect(PRIMARY_SOURCES_MONITORED_LABEL).toContain(source);
    }
  });
});
