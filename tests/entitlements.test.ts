import { describe, it, expect } from "vitest";
import {
  entitlementsFor,
  FREE_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  canAccessMap,
  canExport,
  canViewBuyerEmails,
  canViewFullDetails,
  canConfigureAlerts,
  permittedOpportunityFields,
  sanitizeOpportunity,
} from "../src/lib/entitlements";

describe("Entitlement system", () => {
  describe("Free plan", () => {
    it("does not allow map access", () => {
      expect(canAccessMap(FREE_ENTITLEMENTS)).toBe(false);
    });

    it("does not allow exports", () => {
      expect(canExport(FREE_ENTITLEMENTS)).toBe(false);
    });

    it("does not allow buyer emails", () => {
      expect(canViewBuyerEmails(FREE_ENTITLEMENTS)).toBe(false);
    });

    it("does not allow full details", () => {
      expect(canViewFullDetails(FREE_ENTITLEMENTS)).toBe(false);
    });

    it("does not allow alerts", () => {
      expect(canConfigureAlerts(FREE_ENTITLEMENTS)).toBe(false);
    });

    it("has plan id 'free'", () => {
      expect(FREE_ENTITLEMENTS.plan.id).toBe("free");
    });
  });

  describe("Pro plan", () => {
    it("allows map access", () => {
      expect(canAccessMap(PRO_ENTITLEMENTS)).toBe(true);
    });

    it("allows exports", () => {
      expect(canExport(PRO_ENTITLEMENTS)).toBe(true);
    });

    it("allows buyer emails", () => {
      expect(canViewBuyerEmails(PRO_ENTITLEMENTS)).toBe(true);
    });

    it("allows full details", () => {
      expect(canViewFullDetails(PRO_ENTITLEMENTS)).toBe(true);
    });

    it("allows alerts", () => {
      expect(canConfigureAlerts(PRO_ENTITLEMENTS)).toBe(true);
    });

    it("has plan id 'pro'", () => {
      expect(PRO_ENTITLEMENTS.plan.id).toBe("pro");
    });
  });

  describe("entitlementsFor", () => {
    it("returns Free entitlements for 'free'", () => {
      const e = entitlementsFor("free");
      expect(e.plan.id).toBe("free");
      expect(e.mapEnabled).toBe(false);
    });

    it("returns Pro entitlements for 'pro'", () => {
      const e = entitlementsFor("pro");
      expect(e.plan.id).toBe("pro");
      expect(e.mapEnabled).toBe(true);
    });

    it("throws for unknown plan id", () => {
      expect(() => entitlementsFor("enterprise" as "free" | "pro")).toThrow(
        "Unknown plan",
      );
    });
  });

  describe("permittedOpportunityFields", () => {
    it("returns limited fields for Free", () => {
      const fields = permittedOpportunityFields(FREE_ENTITLEMENTS);
      expect(fields).not.toContain("estimated_value");
      expect(fields).not.toContain("latitude");
      expect(fields).not.toContain("longitude");
      expect(fields).not.toContain("detail_fields");
      expect(fields).toContain("title");
      expect(fields).toContain("summary");
    });

    it("returns full fields for Pro", () => {
      const fields = permittedOpportunityFields(PRO_ENTITLEMENTS);
      expect(fields).toContain("estimated_value");
      expect(fields).toContain("latitude");
      expect(fields).toContain("longitude");
      expect(fields).toContain("detail_fields");
    });
  });

  describe("sanitizeOpportunity", () => {
    const fullRecord = {
      id: "opp-1",
      canonical_id: "canon-1",
      title: "Test Opportunity",
      summary: "A test summary",
      buyer: "Test Buyer",
      sector: "construction",
      region: "ENG",
      location: "London",
      published_date: "2024-01-01",
      closing_date: "2024-12-31",
      estimated_value: 500000,
      currency: "GBP",
      latitude: 51.5,
      longitude: -0.1,
      procurement_stage: "published",
      source_url: "https://example.com/tender/1",
      source_hash: "abc123",
      confidence: 90,
      detail_fields: { key: "value" },
      buyer_email: "buyer@example.com",
    };

    it("strips restricted fields for Free plan", () => {
      const sanitized = sanitizeOpportunity(fullRecord, FREE_ENTITLEMENTS);
      expect(sanitized.estimated_value).toBeUndefined();
      expect(sanitized.latitude).toBeUndefined();
      expect(sanitized.longitude).toBeUndefined();
      expect(sanitized.detail_fields).toBeUndefined();
      expect(sanitized.buyer_email).toBeUndefined();
      expect(sanitized.title).toBe("Test Opportunity");
    });

    it("keeps all permitted fields for Pro plan", () => {
      const sanitized = sanitizeOpportunity(fullRecord, PRO_ENTITLEMENTS);
      expect(sanitized.estimated_value).toBe(500000);
      expect(sanitized.latitude).toBe(51.5);
      expect(sanitized.longitude).toBe(-0.1);
      expect(sanitized.detail_fields).toEqual({ key: "value" });
    });

    it("always strips buyer_email from base record", () => {
      const sanitized = sanitizeOpportunity(fullRecord, PRO_ENTITLEMENTS);
      expect(sanitized.buyer_email).toBeUndefined();
    });
  });
});
