/**
 * CPV (Common Procurement Vocabulary) to Sector mapping.
 *
 * CPV codes are the EU standard classification for public procurement.
 * This mapping ensures strict sector enforcement at ingestion level —
 * only tenders explicitly mapping to our 15 sub-industries across 5 macro
 * sectors are ingested. All other public sector noise (administrative,
 * stationery, catering, education, health, etc.) is dropped before reaching
 * the database.
 */

export type CoreSectorId =
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

export type MacroSectorId =
  | "infrastructure-and-construction"
  | "energy-and-utilities"
  | "technology-and-telecom"
  | "defence-aerospace-and-industrial"
  | "logistics-and-healthcare-capex";

/** CPV code prefix -> Core sector id mapping. */
export const CPV_TO_SECTOR: Record<string, CoreSectorId> = {
  /* Infrastructure & Construction: Construction, civil engineering, real estate */
  "45": "infrastructure", // Construction work
  "451": "construction", // Site preparation
  "452": "infrastructure", // Complete construction
  "453": "infrastructure", // Installation services
  "454": "infrastructure", // Building completion
  "71": "infrastructure", // Architectural, construction, engineering
  "713": "infrastructure", // Engineering services
  "715": "technology-infrastructure", // Architectural services
  "77": "property-and-real-estate", // Real estate services

  /* Energy & Utilities: Oil, gas, electrical energy, utilities */
  "09": "energy", // Oil and gas
  "091": "energy", // Crude petroleum
  "092": "energy", // Petroleum
  "093": "energy", // Natural gas
  "095": "energy", // Liquefied natural gas
  "40": "energy", // Electrical energy
  "401": "energy", // Electrical energy
  "403": "energy", // Electrical energy
  "41": "water-and-environment", // Collected and purified water
  "411": "water-and-environment", // Collected and purified water
  "412": "water-and-environment", // Ice and snow
  "413": "water-and-environment", // Steam and hot water
  "93": "water-and-environment", // Sewage services
  "94": "facilities-management", // Cleaning services

  /* Defence, Aerospace & Industrial: Military construction, equipment, hardware, weapons */
  "42": "defence-and-aerospace", // Military construction
  "23": "defence-and-aerospace", // Military equipment
  "25": "defence-and-aerospace", // Military weapons
  "29": "defence-and-aerospace", // Military vehicles
  "31": "defence-and-aerospace", // Military electronics
  "35": "defence-and-aerospace", // Military hardware
  "39": "defence-and-aerospace", // Military materials
  "24": "engineering", // Chemicals
  "26": "engineering", // Rubber, plastic products
  "27": "engineering", // Non-metallic mineral products
  "28": "engineering", // Basic metals
  "33": "engineering", // Medical equipment
  "37": "engineering", // Metal products

  /* Technology & Telecom: Software, computers, electronics, laboratory equipment */
  "48": "technology-infrastructure", // Software
  "30": "technology-infrastructure", // Computers
  "301": "technology-infrastructure", // Office computers
  "302": "technology-infrastructure", // Computers
  "32": "technology-infrastructure", // Electronics
  "38": "technology-infrastructure", // Laboratory equipment
  "72": "telecommunications", // Telecommunications
  "721": "telecommunications", // Wired telecommunications
  "722": "telecommunications", // Wireless telecommunications
  "723": "telecommunications", // Satellite telecommunications
  "724": "telecommunications", // Other telecommunications

  /* Public Services: Government, public administration */
  "79": "public-sector-services", // Business services
  "791": "public-sector-services", // Business services
  "792": "public-sector-services", // Business services
  "793": "public-sector-services", // Business services
  "794": "public-sector-services", // Business services
  "795": "public-sector-services", // Business services
  "799": "public-sector-services", // Other business services
  "80": "public-sector-services", // Education services
  "801": "public-sector-services", // Primary education
  "802": "public-sector-services", // Secondary education
  "803": "public-sector-services", // Higher education
  "804": "public-sector-services", // Adult education
  "805": "public-sector-services", // Other education

  /* Logistics & Healthcare Capex: Transport, logistics, healthcare */
  "60": "logistics-and-distribution", // Transport services
  "601": "logistics-and-distribution", // Transport
  "34": "logistics-and-distribution", // Transport equipment
  "341": "logistics-and-distribution", // Railway vehicles
  "342": "logistics-and-distribution", // Motor vehicles
  "343": "logistics-and-distribution", // Aircraft
  "344": "logistics-and-distribution", // Ships and boats
  "50": "logistics-and-distribution", // Repair services
  "501": "logistics-and-distribution", // Repair services
  "52": "logistics-and-distribution", // Repair services
  "73": "healthcare-infrastructure", // Research and development
  "731": "healthcare-infrastructure", // Research and development
  "732": "healthcare-infrastructure", // Research and development
  "85": "healthcare-infrastructure", // Health services
  "851": "healthcare-infrastructure", // Hospital services
  "852": "healthcare-infrastructure", // Medical and dental practice
  "853": "healthcare-infrastructure", // Other health services
};

/**
 * CPV codes excluded from ingestion (non-commercial public sector noise).
 * These are explicitly blocked even if they partially match a core sector.
 */
export const EXCLUDED_CPV_PREFIXES: string[] = [
  "55", // Hotel and restaurant services (catering)
  "22", // Printed matter (stationery)
  "80", // Education services
  "92", // Recreational services
  "98", // Other community services
];

/**
 * All 15 sub-industries that are permitted for ingestion.
 */
export const CORE_SECTORS: CoreSectorId[] = [
  "construction",
  "infrastructure",
  "transport",
  "property-and-real-estate",
  "energy",
  "water-and-environment",
  "facilities-management",
  "technology-infrastructure",
  "telecommunications",
  "public-sector-services",
  "defence-and-aerospace",
  "engineering",
  "industrial-and-manufacturing",
  "logistics-and-distribution",
  "healthcare-infrastructure",
];

/**
 * All 5 macro sectors.
 */
export const MACRO_SECTORS: MacroSectorId[] = [
  "infrastructure-and-construction",
  "energy-and-utilities",
  "technology-and-telecom",
  "defence-aerospace-and-industrial",
  "logistics-and-healthcare-capex",
];

/**
 * Mapping from sub-industry to its parent macro sector.
 */
export const SECTOR_TO_MACRO_SECTOR: Record<CoreSectorId, MacroSectorId> = {
  construction: "infrastructure-and-construction",
  infrastructure: "infrastructure-and-construction",
  transport: "infrastructure-and-construction",
  "property-and-real-estate": "infrastructure-and-construction",
  energy: "energy-and-utilities",
  "water-and-environment": "energy-and-utilities",
  "facilities-management": "energy-and-utilities",
  "technology-infrastructure": "technology-and-telecom",
  telecommunications: "technology-and-telecom",
  "public-sector-services": "technology-and-telecom",
  "defence-and-aerospace": "defence-aerospace-and-industrial",
  engineering: "defence-aerospace-and-industrial",
  "industrial-and-manufacturing": "defence-aerospace-and-industrial",
  "logistics-and-distribution": "logistics-and-healthcare-capex",
  "healthcare-infrastructure": "logistics-and-healthcare-capex",
};

/**
 * Mapping from macro sector to its sub-industries.
 */
export const MACRO_SECTOR_TO_SUB_SECTORS: Record<MacroSectorId, CoreSectorId[]> =
  {
    "infrastructure-and-construction": [
      "construction",
      "infrastructure",
      "transport",
      "property-and-real-estate",
    ],
    "energy-and-utilities": [
      "energy",
      "water-and-environment",
      "facilities-management",
    ],
    "technology-and-telecom": [
      "technology-infrastructure",
      "telecommunications",
      "public-sector-services",
    ],
    "defence-aerospace-and-industrial": [
      "defence-and-aerospace",
      "engineering",
      "industrial-and-manufacturing",
    ],
    "logistics-and-healthcare-capex": [
      "logistics-and-distribution",
      "healthcare-infrastructure",
    ],
  };

/**
 * Extracts the CPV code prefix (first 1-3 digits) from a CPV code string.
 * Returns null if no valid CPV code is found.
 */
export function extractCpfPrefix(cpvCode: unknown): string | null {
  if (cpvCode == null) return null;
  const str = String(cpvCode).trim();
  if (!str) return null;
  // CPV codes are 8+ digits, sometimes with hyphens. Extract leading digits.
  const match = str.match(/^(\d{1,3})/);
  return match ? match[1] : null;
}

/**
 * Maps a CPV code to a sub-industry id.
 * Returns null if the CPV code does not map to a known sector.
 */
export function cpvToSector(cpvCode: unknown): CoreSectorId | null {
  const prefix = extractCpfPrefix(cpvCode);
  if (!prefix) return null;

  // Check excluded prefixes first
  for (const excluded of EXCLUDED_CPV_PREFIXES) {
    if (prefix.startsWith(excluded)) return null;
  }

  // Check exact prefix match first, then fallback to shorter prefixes
  if (CPV_TO_SECTOR[prefix]) return CPV_TO_SECTOR[prefix];

  // Try shorter prefixes (2-digit, then 1-digit)
  if (prefix.length >= 2 && CPV_TO_SECTOR[prefix.slice(0, 2)])
    return CPV_TO_SECTOR[prefix.slice(0, 2)];
  if (prefix.length >= 1 && CPV_TO_SECTOR[prefix.slice(0, 1)])
    return CPV_TO_SECTOR[prefix.slice(0, 1)];

  return null;
}

/**
 * Determines whether a CPV code maps to an ingestible sub-industry.
 */
export function isIngestibleSector(cpvCode: unknown): boolean {
  return cpvToSector(cpvCode) !== null;
}

/**
 * Returns the macro sector id for a given sub-industry id.
 */
export function getMacroSectorForSubIndustry(
  subIndustryId: CoreSectorId,
): MacroSectorId | null {
  return SECTOR_TO_MACRO_SECTOR[subIndustryId] ?? null;
}

/**
 * Returns all sub-industry ids belonging to a macro sector.
 */
export function getSubIndustriesForMacroSector(
  macroSectorId: MacroSectorId,
): readonly CoreSectorId[] {
  return MACRO_SECTOR_TO_SUB_SECTORS[macroSectorId] ?? [];
}

/**
 * Extracts sector-relevant text from a source record for keyword matching.
 */
export function extractSectorText(record: { rawPayload: Record<string, unknown> }): string {
  const payload = record.rawPayload;
  const fields: string[] = [];

  // Collect text from common sector-bearing fields
  for (const key of [
    "title", "summary", "description", "buyer", "sector",
    "category", "cpv", "cpv_code", "procurement_category",
    "object",
  ]) {
    const val = payload[key];
    if (val != null) fields.push(String(val));
  }

  // Also check tender sub-object
  const tender = payload.tender as Record<string, unknown> | undefined;
  if (tender) {
    for (const key of ["title", "description", "cpv", "main_cpv"]) {
      const val = tender[key];
      if (val != null) fields.push(String(val));
    }
  }

  return fields.join(" ").toLowerCase();
}

/**
 * Determines the sector from a source record using CPV codes first,
 * falling back to keyword matching.
 *
 * Returns the sector id if the record maps to a known sub-industry,
 * or null if it should be dropped.
 */
export function determineSector(
  record: { rawPayload: Record<string, unknown> },
): CoreSectorId | null {
  const payload = record.rawPayload;

  // Step 1: Try CPV code from various possible field locations
  const cpvSources = [
    payload.cpv,
    payload.cpv_code,
    payload.main_cpv,
    payload.additional_cpv,
    payload.procurement_category,
    payload.category,
  ];

  const tender = payload.tender as Record<string, unknown> | undefined;
  if (tender) {
    cpvSources.push(tender.cpv, tender.cpv_code, tender.main_cpv);
  }

  for (const cpv of cpvSources) {
    const sector = cpvToSector(cpv);
    if (sector) return sector;
  }

  // Step 2: Fallback to keyword matching on sector-relevant text
  const text = extractSectorText(record);
  if (!text) return null;

  // Score each sector by keyword matches
  const scores: Record<CoreSectorId, number> = {
    construction: 0,
    infrastructure: 0,
    transport: 0,
    "property-and-real-estate": 0,
    energy: 0,
    "water-and-environment": 0,
    "facilities-management": 0,
    "technology-infrastructure": 0,
    telecommunications: 0,
    "public-sector-services": 0,
    "defence-and-aerospace": 0,
    engineering: 0,
    "industrial-and-manufacturing": 0,
    "logistics-and-distribution": 0,
    "healthcare-infrastructure": 0,
  };

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        scores[sector as CoreSectorId] += 1;
      }
    }
  }

  // Return the sector with the highest score (must have at least 1 match)
  let bestSector: CoreSectorId | null = null;
  let bestScore = 0;
  for (const [sector, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestSector = sector as CoreSectorId;
    }
  }

  return bestScore > 0 ? bestSector : null;
}

/**
 * Sector keywords for fallback keyword matching when CPV codes are unavailable.
 * Keywords are lowercase and matched against title, summary, buyer text.
 */
export const SECTOR_KEYWORDS: Record<CoreSectorId, string[]> = {
  construction: [
    "construction", "civil", "building", "site preparation",
    "building completion", "renovation", "refurbishment",
  ],
  infrastructure: [
    "infrastructure", "highway", "bridge", "road", "railway",
    "rail", "airport", "port", "harbour", "urban",
  ],
  transport: [
    "transport", "freight", "shipping", "logistics",
    "delivery", "warehouse", "fleet", "vehicle", "courier",
  ],
  "property-and-real-estate": [
    "real estate", "property", "estate", "urban",
    "commercial", "residential", "land",
  ],
  energy: [
    "energy", "oil", "gas", "petroleum", "electricity",
    "power", "renewable", "wind", "solar", "nuclear",
    "grid", "utility", "utilities", "natural gas", "crude",
    "electrical",
  ],
  "water-and-environment": [
    "water", "sewage", "waste", "environmental",
    "purified water", "ice", "steam", "hot water",
  ],
  "facilities-management": [
    "facilities", "maintenance", "cleaning",
    "building maintenance", "cleaning services",
  ],
  "technology-infrastructure": [
    "technology", "software", "computer", "digital",
    "electronics", "it", "ict", "data", "cyber", "ai",
    "cloud", "network",
  ],
  telecommunications: [
    "telecommunications", "telecom", "network",
    "wired", "wireless", "satellite",
  ],
  "public-sector-services": [
    "public sector", "government", "administration",
    "professional services", "business services",
  ],
  "defence-and-aerospace": [
    "defence", "defense", "military", "armed", "combat",
    "weapon", "munition", "security", "naval",
    "army", "air force", "airforce", "aerospace",
  ],
  engineering: [
    "engineering", "technical", "specialist",
    "chemicals", "metals", "rubber", "plastics",
  ],
  "industrial-and-manufacturing": [
    "industrial", "manufacturing", "factory", "plant",
    "equipment", "supply", "metals", "minerals",
  ],
  "logistics-and-distribution": [
    "logistics", "transport", "shipping", "freight",
    "delivery", "warehouse", "supply", "distribution",
    "fleet", "vehicle", "postal", "courier",
  ],
  "healthcare-infrastructure": [
    "healthcare", "hospital", "clinic", "medical",
    "healthcare estate", "procurement", "research",
    "development", "health",
  ],
};
