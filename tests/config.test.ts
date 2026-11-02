import { describe, it, expect } from "vitest";
import {
  SECTORS,
  SECTORS_BY_ID,
  isValidSectorId,
  type SectorId,
} from "../src/lib/config/sectors";
import { REGIONS, isValidRegion, type Region } from "../src/lib/config/regions";

describe("Sector configuration", () => {
  it("has exactly 15 sectors", () => {
    expect(SECTORS).toHaveLength(15);
  });

  it("has the correct sector names", () => {
    const names = SECTORS.map((s) => s.name);
    expect(names).toContain("Construction");
    expect(names).toContain("Infrastructure");
    expect(names).toContain("Energy");
    expect(names).toContain("Industrial and Manufacturing");
    expect(names).toContain("Logistics and Distribution");
    expect(names).toContain("Technology Infrastructure");
    expect(names).toContain("Property and Real Estate");
    expect(names).toContain("Engineering");
    expect(names).toContain("Facilities Management");
    expect(names).toContain("Transport");
    expect(names).toContain("Water and Environment");
    expect(names).toContain("Telecommunications");
    expect(names).toContain("Healthcare Infrastructure");
    expect(names).toContain("Defence and Aerospace");
    expect(names).toContain("Public Sector Services");
  });

  it("validates known sector ids", () => {
    expect(isValidSectorId("construction")).toBe(true);
    expect(isValidSectorId("healthcare-infrastructure")).toBe(true);
    expect(isValidSectorId("not-a-sector")).toBe(false);
  });

  it("looks up sectors by id", () => {
    expect(SECTORS_BY_ID.construction.name).toBe("Construction");
    expect(SECTORS_BY_ID["public-sector-services"].name).toBe(
      "Public Sector Services",
    );
  });

  it("derives SectorId type from sector list", () => {
    const id: SectorId = "energy";
    expect(id).toBe("energy");
  });
});

describe("Region configuration", () => {
  it("has exactly 9 regions", () => {
    expect(REGIONS).toHaveLength(9);
  });

  it("has the correct region codes", () => {
    expect(REGIONS).toContain("US");
    expect(REGIONS).toContain("CA");
    expect(REGIONS).toContain("ENG");
    expect(REGIONS).toContain("SCT");
    expect(REGIONS).toContain("WLS");
    expect(REGIONS).toContain("NIR");
    expect(REGIONS).toContain("IE");
    expect(REGIONS).toContain("AU");
    expect(REGIONS).toContain("EU");
  });

  it("validates known regions", () => {
    expect(isValidRegion("ENG")).toBe(true);
    expect(isValidRegion("xx")).toBe(false);
  });

  it("derives Region type from region list", () => {
    const region: Region = "US";
    expect(region).toBe("US");
  });
});
