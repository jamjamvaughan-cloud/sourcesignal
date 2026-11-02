import { describe, it, expect } from "vitest";
import {
  sha256,
  sha256Buffer,
  hashSourceSnapshot,
  hashCanonicalId,
} from "../worker/src/utils/hash";
import { extractFields } from "../worker/src/pipeline/extract";
import type { NormalisedOpportunity } from "../worker/src/types";

describe("SHA-256 provenance", () => {
  it("computes a deterministic hash for a string", () => {
    const h1 = sha256("hello world");
    const h2 = sha256("hello world");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h1)).toBe(true);
  });

  it("produces different hashes for different inputs", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("computes hash for a Buffer", () => {
    const h1 = sha256Buffer(Buffer.from("hello world"));
    const h2 = sha256("hello world");
    expect(h1).toBe(h2);
  });

  it("hashes source snapshots deterministically", () => {
    const url = "https://example.com/tender/1";
    const payload = { title: "Test", buyer: "Buyer" };
    const h1 = hashSourceSnapshot(url, payload);
    const h2 = hashSourceSnapshot(url, payload);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("produces different hashes for different payloads", () => {
    const url = "https://example.com/tender/1";
    expect(hashSourceSnapshot(url, { a: 1 })).not.toBe(
      hashSourceSnapshot(url, { a: 2 }),
    );
  });

  it("generates canonical IDs deterministically", () => {
    const id1 = hashCanonicalId("demo", "https://example.com/1", "rec-1");
    const id2 = hashCanonicalId("demo", "https://example.com/1", "rec-1");
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(64);
  });

  it("generates different canonical IDs for different sources", () => {
    expect(
      hashCanonicalId("demo", "https://example.com/1", "rec-1"),
    ).not.toBe(hashCanonicalId("demo", "https://example.com/2", "rec-1"));
  });
});

describe("Rule-based extraction", () => {
  const baseOpportunity: NormalisedOpportunity = {
    canonicalId: "canon-1",
    title: "Test Opportunity",
    summary: "A test summary",
    buyer: "Test Buyer",
    sector: "construction",
    region: "ENG",
    location: "London",
    publishedDate: "2024-01-01",
    closingDate: "2024-12-31",
    estimatedValue: 500000,
    currency: "GBP",
    procurementStage: "published",
    sourceUrl: "https://example.com/tender/1",
    confidence: 90,
    detailFields: { key: "value" },
  };

  it("extracts directly-sourced fields without inference", async () => {
    const result = await extractFields(baseOpportunity);
    expect(result.success).toBe(true);
    expect(result.inferred).toBe(false);
    expect(result.fields.estimatedValue).toBe(500000);
    expect(result.fields.currency).toBe("GBP");
    expect(result.fields.closingDate).toBe("2024-12-31");
  });

  it("does not infer missing values", async () => {
    const minimal: NormalisedOpportunity = {
      canonicalId: "canon-2",
      title: "Minimal",
      sector: "energy",
      region: "US",
      sourceUrl: "https://example.com/tender/2",
    };
    const result = await extractFields(minimal);
    expect(result.success).toBe(true);
    expect(result.inferred).toBe(false);
    expect(result.fields.estimatedValue).toBeUndefined();
    expect(result.fields.closingDate).toBeUndefined();
    expect(result.fields.buyer).toBeUndefined();
  });

  it("returns partial status when few fields present", async () => {
    const minimal: NormalisedOpportunity = {
      canonicalId: "canon-3",
      title: "Minimal",
      sector: "transport",
      region: "CA",
      sourceUrl: "https://example.com/tender/3",
    };
    const result = await extractFields(minimal);
    expect(result.status).toBe("partial");
  });
});
