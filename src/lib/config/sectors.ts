/**
 * Supported procurement sectors.
 *
 * Central, reusable configuration. These are the 15 sector IDs SourceSignal
 * tracks, organized into 5 parent macro sectors for hierarchical filtering.
 * The list is intentionally fixed; changes require a code change and review
 * so that sector-scoped access, alerts and reporting stay consistent.
 */

export interface SubIndustry {
  /** Stable machine-readable identifier (used in URLs, filters and exports). */
  readonly id: string;
  /** Human-readable sub-industry name. */
  readonly name: string;
  /** Short description shown in the sector directory. */
  readonly description: string;
}

export interface MacroSector {
  /** Stable machine-readable identifier (used in URLs, filters and exports). */
  readonly id: string;
  /** Human-readable macro sector name. */
  readonly name: string;
  /** Short description shown in the sector directory. */
  readonly description: string;
  /** Child sub-industries belonging to this macro sector. */
  readonly subIndustries: readonly SubIndustry[];
}

/** Sector IDs as a union type, derived from the sector list. */
export type SectorId =
  | "construction"
  | "infrastructure"
  | "transport"
  | "property-and-real-estate"
  | "energy"
  | "water-and-environment"
  | "facilities-management"
  | "technology-infrastructure"
  | "telecommunications"
  | "public-sector-services"
  | "defence-and-aerospace"
  | "engineering"
  | "industrial-and-manufacturing"
  | "logistics-and-distribution"
  | "healthcare-infrastructure";

/** Macro sector IDs as a union type. */
export type MacroSectorId =
  | "infrastructure-and-construction"
  | "energy-and-utilities"
  | "technology-and-telecom"
  | "defence-aerospace-and-industrial"
  | "logistics-and-healthcare-capex";

/**
 * All 15 sub-industries, flat list.
 */
export const SECTORS: readonly SubIndustry[] = [
  {
    id: "construction",
    name: "Construction",
    description: "Building and civil engineering procurement opportunities.",
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Transport, utilities and major infrastructure programmes.",
  },
  {
    id: "transport",
    name: "Transport",
    description: "Passenger and freight transport services and infrastructure.",
  },
  {
    id: "property-and-real-estate",
    name: "Property and Real Estate",
    description: "Commercial, residential and public estate transactions.",
  },
  {
    id: "energy",
    name: "Energy",
    description: "Power generation, transmission and renewable energy projects.",
  },
  {
    id: "water-and-environment",
    name: "Water and Environment",
    description: "Water supply, waste management and environmental services.",
  },
  {
    id: "facilities-management",
    name: "Facilities Management",
    description: "Building maintenance, cleaning and facilities services.",
  },
  {
    id: "technology-infrastructure",
    name: "Technology Infrastructure",
    description: "Digital infrastructure, connectivity and IT systems procurement.",
  },
  {
    id: "telecommunications",
    name: "Telecommunications",
    description: "Network, broadcast and communications infrastructure.",
  },
  {
    id: "public-sector-services",
    name: "Public Sector Services",
    description: "Government and public administration professional services.",
  },
  {
    id: "defence-and-aerospace",
    name: "Defence and Aerospace",
    description: "Defence, aerospace and security procurement programmes.",
  },
  {
    id: "engineering",
    name: "Engineering",
    description: "Specialist engineering and technical services contracts.",
  },
  {
    id: "industrial-and-manufacturing",
    name: "Industrial and Manufacturing",
    description: "Factory plant, equipment and industrial supply contracts.",
  },
  {
    id: "logistics-and-distribution",
    name: "Logistics and Distribution",
    description: "Warehousing, freight and distribution network contracts.",
  },
  {
    id: "healthcare-infrastructure",
    name: "Healthcare Infrastructure",
    description: "Hospital, clinic and healthcare estate procurement.",
  },
] as const;

/**
 * Lookup of sub-industry by id, for validation and canonicalisation.
 */
export const SECTORS_BY_ID: Record<SectorId, SubIndustry> = Object.fromEntries(
  SECTORS.map((s) => [s.id, s]),
) as Record<SectorId, SubIndustry>;

/**
 * All 5 macro sectors with their child sub-industries.
 */
export const MACRO_SECTORS: readonly MacroSector[] = [
  {
    id: "infrastructure-and-construction",
    name: "Infrastructure & Construction",
    description: "Building, civil engineering, transport, utilities and real estate.",
    subIndustries: [
      SECTORS_BY_ID.construction,
      SECTORS_BY_ID.infrastructure,
      SECTORS_BY_ID.transport,
      SECTORS_BY_ID["property-and-real-estate"],
    ],
  },
  {
    id: "energy-and-utilities",
    name: "Energy & Utilities",
    description: "Power generation, transmission, water, waste and facilities.",
    subIndustries: [
      SECTORS_BY_ID.energy,
      SECTORS_BY_ID["water-and-environment"],
      SECTORS_BY_ID["facilities-management"],
    ],
  },
  {
    id: "technology-and-telecom",
    name: "Technology & Telecom",
    description: "Digital infrastructure, connectivity, IT and public services.",
    subIndustries: [
      SECTORS_BY_ID["technology-infrastructure"],
      SECTORS_BY_ID.telecommunications,
      SECTORS_BY_ID["public-sector-services"],
    ],
  },
  {
    id: "defence-aerospace-and-industrial",
    name: "Defence, Aerospace & Industrial",
    description: "Defence, aerospace, security, engineering and manufacturing.",
    subIndustries: [
      SECTORS_BY_ID["defence-and-aerospace"],
      SECTORS_BY_ID.engineering,
      SECTORS_BY_ID["industrial-and-manufacturing"],
    ],
  },
  {
    id: "logistics-and-healthcare-capex",
    name: "Logistics & Healthcare Capex",
    description: "Warehousing, freight, distribution and healthcare capital projects.",
    subIndustries: [
      SECTORS_BY_ID["logistics-and-distribution"],
      SECTORS_BY_ID["healthcare-infrastructure"],
    ],
  },
] as const;

/**
 * Lookup of macro sector by id.
 */
export const MACRO_SECTORS_BY_ID: Record<MacroSectorId, MacroSector> = Object.fromEntries(
  MACRO_SECTORS.map((s) => [s.id, s]),
) as Record<MacroSectorId, MacroSector>;

/**
 * Validates whether a string is a known sub-industry id.
 */
export function isValidSectorId(value: string): value is SectorId {
  return value in SECTORS_BY_ID;
}

/**
 * Validates whether a string is a known macro sector id.
 */
export function isValidMacroSectorId(value: string): value is MacroSectorId {
  return value in MACRO_SECTORS_BY_ID;
}

/**
 * Returns the macro sector id for a given sub-industry id.
 * Returns null if the sub-industry id is not found.
 */
export function getMacroSectorForSubIndustry(
  subIndustryId: SectorId,
): MacroSectorId | null {
  for (const macroSector of MACRO_SECTORS) {
    if (macroSector.subIndustries.some((s) => s.id === subIndustryId)) {
      return macroSector.id as MacroSectorId;
    }
  }
  return null;
}

/**
 * Returns the sub-industries belonging to a macro sector.
 * Returns an empty array if the macro sector id is not found.
 */
export function getSubIndustriesForMacroSector(
  macroSectorId: MacroSectorId,
): readonly SubIndustry[] {
  const macroSector = MACRO_SECTORS_BY_ID[macroSectorId];
  return macroSector ? macroSector.subIndustries : [];
}

/**
 * Returns all sub-industry ids belonging to a macro sector.
 */
export function getSubIndustryIdsForMacroSector(
  macroSectorId: MacroSectorId,
): readonly SectorId[] {
  const macroSector = MACRO_SECTORS_BY_ID[macroSectorId];
  return macroSector
    ? macroSector.subIndustries.map((s) => s.id as SectorId)
    : [];
}
