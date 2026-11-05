import { describe, expect, it } from "vitest";
import {
  matchesFilters,
  signPayload,
  buildSignalPayload,
} from "../src/lib/webhooks/dispatcher";
import {
  computeSignalHash,
  buildAuditSnapshot,
  hashString,
} from "../src/lib/ingestion/provenance";

// dispatcher.SignalPayload shape (snake_case, DB-aligned)
const webhook = {
  id: "w-1",
  user_id: "u-1",
  url: "https://example.com/hook",
  secret: "s3cr3t",
  sector_filters: ["TECH", "PUBLIC_SECTOR"],
  min_value: 1000,
  is_active: true,
};

const payloadSignal = {
  id: "s-1",
  title: "Test signal",
  buyer_name: "Acme Corp",
  jurisdiction: "UK",
  sector: "TECH",
  opportunity_type: "PROJECT",
  estimated_value: 5000,
  source_name: "Test Source",
  source_url: "https://example.com/notice/1",
  source_hash: "src-hash",
  commercial_why: "This is a test signal.",
  published_at: "2026-01-01T00:00:00Z",
  sha256_hash: "payload-hash",
};

// ingestion.NormalisedSignal shape (camelCase)
const normalisedSignal = {
  id: "s-1",
  title: "Test signal",
  buyerName: "Acme Corp",
  jurisdiction: "UK",
  sector: "TECH",
  opportunityType: "PROJECT",
  estimatedValue: 5000,
  sourceName: "Test Source",
  sourceUrl: "https://example.com/notice/1",
  sourceHash: "src-hash",
  commercialWhy: "This is a test signal.",
  publishedAt: "2026-01-01T00:00:00Z",
  sha256Hash: "payload-hash",
};

describe("webhook dispatcher filters", () => {
  it("matches when sector is in filters and value exceeds min", () => {
    expect(matchesFilters(webhook, payloadSignal)).toBe(true);
  });

  it("excludes signals outside the sector filters", () => {
    expect(
      matchesFilters(webhook, { ...payloadSignal, sector: "ENERGY" }),
    ).toBe(false);
  });

  it("excludes signals below the minimum value", () => {
    expect(
      matchesFilters(webhook, { ...payloadSignal, estimated_value: 500 }),
    ).toBe(false);
  });

  it("matches all sectors when filters are empty", () => {
    expect(
      matchesFilters(
        { ...webhook, sector_filters: [] },
        { ...payloadSignal, sector: "ENERGY" },
      ),
    ).toBe(true);
  });

  it("includes signals with undisclosed value when min is set", () => {
    expect(
      matchesFilters(webhook, { ...payloadSignal, estimated_value: null }),
    ).toBe(true);
  });
});

describe("webhook payload signing", () => {
  it("produces a deterministic HMAC-SHA256 signature", () => {
    const payload = buildSignalPayload(payloadSignal);
    const sig = signPayload(webhook.secret, payload);
    expect(sig).toBe(signPayload(webhook.secret, payload));
    expect(typeof sig).toBe("string");
    expect(sig.length).toBe(64);
  });
});

describe("cryptographic provenance", () => {
  it("computes a stable SHA-256 hash from a raw payload", () => {
    const payload = { notice: { id: "1" }, foo: "bar" };
    expect(computeSignalHash(payload)).toBe(computeSignalHash(payload));
    expect(computeSignalHash(null)).toBe(computeSignalHash({}));
    expect(computeSignalHash({ b: 2, a: 1 })).toBe(
      computeSignalHash({ a: 1, b: 2 }),
    );
  });

  it("hashString is deterministic", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
    expect(hashString("hello")).not.toBe(hashString("world"));
  });

  it("buildAuditSnapshot renders HTML containing the signal fields", () => {
    const html = buildAuditSnapshot(normalisedSignal);
    expect(typeof html).toBe("string");
    expect(html).toContain("Cryptographic Provenance Snapshot");
    expect(html).toContain(normalisedSignal.title);
    expect(html).toContain(normalisedSignal.buyerName);
    expect(html).toContain(normalisedSignal.sector);
    expect(html).toContain("SHA-256");
    expect(html).toContain(normalisedSignal.sourceUrl);
  });

  it("handles signals with no raw payload", () => {
    const html = buildAuditSnapshot({ ...normalisedSignal, rawPayload: undefined });
    expect(html).toContain("Cryptographic Provenance Snapshot");
  });
});
