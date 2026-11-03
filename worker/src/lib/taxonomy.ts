/**
 * Controlled taxonomy for SourceSignal commercial opportunity engine.
 *
 * Duplicate of the main src/lib/taxonomy.ts for the worker deployment,
 * which has its own tsconfig and module resolution.
 */

export type SectorId =
  | "technology-infrastructure"
  | "energy"
  | "construction"
  | "healthcare-infrastructure"
  | "transport"
  | "logistics-and-distribution"
  | "public-sector-services";

export type SubCategoryId = string;

export type OpportunityType =
  | "PROJECT"
  | "PROCUREMENT"
  | "EXPANSION"
  | "TRANSFORMATION"
  | "COMPLIANCE"
  | "MODERNISATION"
  | "FUNDING"
  | "CONTRACT_FRAMEWORK"
  | "POLICY_PROGRAMME";

export interface SubCategory {
  id: SubCategoryId;
  label: string;
}

export interface Sector {
  id: SectorId;
  label: string;
  subCategories: SubCategory[];
}

export const TAXONOMY: Sector[] = [
  {
    id: "technology-infrastructure",
    label: "Technology Infrastructure",
    subCategories: [
      { id: "cloud-migration", label: "Cloud Migration" },
      { id: "enterprise-software", label: "Enterprise Software" },
      { id: "cybersecurity", label: "Cybersecurity" },
      { id: "data-center-operations", label: "Data Center Operations" },
      { id: "it-procurement", label: "IT Procurement" },
      { id: "digital-transformation", label: "Digital Transformation" },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    subCategories: [
      { id: "grid-modernization", label: "Grid Modernization" },
      { id: "renewable-energy-transition", label: "Renewable Energy Transition" },
      { id: "net-zero-compliance", label: "Net Zero Compliance" },
      { id: "utilities-infrastructure", label: "Utilities Infrastructure" },
      { id: "smart-metering", label: "Smart Metering" },
    ],
  },
  {
    id: "construction",
    label: "Construction",
    subCategories: [
      { id: "building-safety-act-compliance", label: "Building Safety Act Compliance" },
      { id: "commercial-real-estate-development", label: "Commercial Real Estate Development" },
      { id: "public-works", label: "Public Works" },
      { id: "structural-engineering", label: "Structural Engineering" },
    ],
  },
  {
    id: "healthcare-infrastructure",
    label: "Healthcare Infrastructure",
    subCategories: [
      { id: "ehr-implementation", label: "EHR Implementation" },
      { id: "nhs-digital-plan-integration", label: "NHS Digital Plan Integration" },
      { id: "clinical-systems", label: "Clinical Systems" },
      { id: "medical-facility-procurement", label: "Medical Facility Procurement" },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    subCategories: [
      { id: "transport-decarbonisation", label: "Transport Decarbonisation" },
      { id: "smart-transit-systems", label: "Smart Transit Systems" },
      { id: "rail-aviation-infrastructure", label: "Rail & Aviation Infrastructure" },
      { id: "fleet-electrification", label: "Fleet Electrification" },
    ],
  },
  {
    id: "logistics-and-distribution",
    label: "Logistics & Distribution",
    subCategories: [
      { id: "supply-chain-automation", label: "Supply Chain Automation" },
      { id: "automated-warehousing", label: "Automated Warehousing" },
      { id: "freight-transport-logistics", label: "Freight & Transport Logistics" },
      { id: "inventory-management-systems", label: "Inventory Management Systems" },
    ],
  },
  {
    id: "public-sector-services",
    label: "Public Sector Services",
    subCategories: [
      { id: "government-digital-services", label: "Government Digital Services" },
      { id: "municipal-infrastructure", label: "Municipal Infrastructure" },
      { id: "defense-security-procurement", label: "Defense & Security Procurement" },
      { id: "cross-border-public-frameworks", label: "Cross-Border Public Frameworks" },
    ],
  },
];

export const SUBCATEGORY_TO_SECTOR: Map<SubCategoryId, SectorId> = new Map();
for (const sector of TAXONOMY) {
  for (const subCat of sector.subCategories) {
    SUBCATEGORY_TO_SECTOR.set(subCat.id, sector.id);
  }
}

export const SECTOR_LABELS: Map<SectorId, string> = new Map();
for (const sector of TAXONOMY) {
  SECTOR_LABELS.set(sector.id, sector.label);
}

export const SUBCATEGORY_LABELS: Map<SubCategoryId, string> = new Map();
for (const sector of TAXONOMY) {
  for (const subCat of sector.subCategories) {
    SUBCATEGORY_LABELS.set(subCat.id, subCat.label);
  }
}

export function isValidSector(sectorId: string): sectorId is SectorId {
  return TAXONOMY.some((s) => s.id === sectorId);
}

export function isValidSubCategory(
  sectorId: SectorId,
  subCategoryId: string,
): subCategoryId is SubCategoryId {
  const sector = TAXONOMY.find((s) => s.id === sectorId);
  return sector?.subCategories.some((sc) => sc.id === subCategoryId) ?? false;
}

export function isValidOpportunityType(type: string): type is OpportunityType {
  const valid: OpportunityType[] = [
    "PROJECT",
    "PROCUREMENT",
    "EXPANSION",
    "TRANSFORMATION",
    "COMPLIANCE",
    "MODERNISATION",
    "FUNDING",
    "CONTRACT_FRAMEWORK",
    "POLICY_PROGRAMME",
  ];
  return valid.includes(type as OpportunityType);
}

export function getSectorIds(): SectorId[] {
  return TAXONOMY.map((s) => s.id);
}

export function getSubCategoriesForSector(sectorId: SectorId): SubCategory[] {
  const sector = TAXONOMY.find((s) => s.id === sectorId);
  return sector?.subCategories ?? [];
}

export function getAllSubCategoryIds(): SubCategoryId[] {
  return TAXONOMY.flatMap((s) => s.subCategories.map((sc) => sc.id));
}

export function mapSectorToTaxonomy(rawSector: string | undefined): SectorId | null {
  if (!rawSector) return null;
  const normalized = rawSector.toLowerCase().trim();

  if (isValidSector(normalized)) return normalized;

  for (const sector of TAXONOMY) {
    if (sector.label.toLowerCase() === normalized) return sector.id;
  }

  for (const sector of TAXONOMY) {
    if (normalized.includes(sector.label.toLowerCase())) return sector.id;
    if (sector.label.toLowerCase().includes(normalized)) return sector.id;
  }

  return null;
}

export function mapSubCategoryToTaxonomy(
  sectorId: SectorId | null,
  rawSubCategory: string | undefined,
): SubCategoryId | null {
  if (!rawSubCategory || !sectorId) return null;
  const normalized = rawSubCategory.toLowerCase().trim();

  if (isValidSubCategory(sectorId, normalized)) return normalized;

  const subcats = getSubCategoriesForSector(sectorId);
  for (const sc of subcats) {
    if (sc.label.toLowerCase() === normalized) return sc.id;
  }

  for (const sc of subcats) {
    if (normalized.includes(sc.label.toLowerCase())) return sc.id;
    if (sc.label.toLowerCase().includes(normalized)) return sc.id;
  }

  return null;
}

export function mapOpportunityType(raw: string | undefined): OpportunityType | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim();

  const typeMap: Record<string, OpportunityType> = {
    project: "PROJECT",
    "new project": "PROJECT",
    construction: "PROJECT",
    build: "PROJECT",
    infrastructure: "PROJECT",
    procurement: "PROCUREMENT",
    tender: "PROCUREMENT",
    rfp: "PROCUREMENT",
    "request for proposal": "PROCUREMENT",
    "framework notice": "PROCUREMENT",
    "supplier engagement": "PROCUREMENT",
    expansion: "EXPANSION",
    warehouse: "EXPANSION",
    facility: "EXPANSION",
    "network expansion": "EXPANSION",
    transformation: "TRANSFORMATION",
    "cloud migration": "TRANSFORMATION",
    "digital transformation": "TRANSFORMATION",
    "digital modernisation": "TRANSFORMATION",
    "digital modernization": "TRANSFORMATION",
    compliance: "COMPLIANCE",
    "building safety act": "COMPLIANCE",
    "net zero": "COMPLIANCE",
    regulatory: "COMPLIANCE",
    modernisation: "MODERNISATION",
    modernization: "MODERNISATION",
    "legacy replacement": "MODERNISATION",
    "grid modernization": "MODERNISATION",
    "clinical system upgrade": "MODERNISATION",
    funding: "FUNDING",
    "capital commitment": "FUNDING",
    "infrastructure investment": "FUNDING",
    "contract_framework": "CONTRACT_FRAMEWORK",
    framework: "CONTRACT_FRAMEWORK",
    "framework awarded": "CONTRACT_FRAMEWORK",
    "renewal window": "CONTRACT_FRAMEWORK",
    dps: "CONTRACT_FRAMEWORK",
    "policy_programme": "POLICY_PROGRAMME",
    programme: "POLICY_PROGRAMME",
    program: "POLICY_PROGRAMME",
    decarbonisation: "POLICY_PROGRAMME",
    decarbonization: "POLICY_PROGRAMME",
    "nhs digital": "POLICY_PROGRAMME",
  };

  if (typeMap[normalized]) return typeMap[normalized];

  for (const [key, type] of Object.entries(typeMap)) {
    if (normalized.includes(key)) return type;
  }

  return null;
}

export function passesHardFilter(
  sector: string | null | undefined,
  subCategory: string | null | undefined,
  opportunityType: string | null | undefined,
  buyer: string | null | undefined,
  procurementStage?: string | null,
  isDemonstration?: boolean,
): boolean {
  const resolvedSector = sector ? mapSectorToTaxonomy(sector) : null;
  if (!resolvedSector) return false;

  const resolvedSubCategory = subCategory
    ? mapSubCategoryToTaxonomy(resolvedSector, subCategory)
    : null;
  if (!resolvedSubCategory) return false;

  const resolvedOpportunityType = opportunityType
    ? mapOpportunityType(opportunityType)
    : null;
  if (!resolvedOpportunityType) return false;

  if (!buyer || buyer.trim().length === 0) return false;

  const stage = (procurementStage ?? "").toLowerCase();
  if (
    !isDemonstration &&
    ["cancelled", "canceled", "aborted", "withdrawn", "terminated", "void"].some(
      (kw) => stage.includes(kw),
    )
  ) {
    return false;
  }

  return true;
}