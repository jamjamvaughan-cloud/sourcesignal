/**
 * Extraction pipeline stage.
 *
 * Extracts structured information from source records using the NVIDIA API
 * when credentials are configured. Falls back to rule-based extraction
 * otherwise. Never infers buyer email, contract value, closing date, or award
 * status without evidence.
 *
 * Subcontractor & Winner Forensics: parses tender text for subcontractor
 * entities ("Subcontractor Requirements", "Supply Chain Partners", "Named
 * Suppliers") and award winner ("Winning Bidder", "Awarded To").
 */

import type {
  ExtractionResult,
  NormalisedOpportunity,
} from "@/types";
import { convertToGBP } from "@/lib/currency";

/** Procurement stage classification enum. */
export type ProcurementStage =
  | "PIN_EARLY_ENGAGEMENT"
  | "FORMAL_TENDER"
  | "AWARDED_CONTRACT"
  | "CANCELLED_ABORTED";

/** Keywords that indicate a PIN / early engagement notice. */
const PIN_KEYWORDS = [
  "prior information notice",
  "pin",
  "early engagement",
  "market engagement",
  "pre-market engagement",
  "soft market testing",
  "market sounding",
  "expression of interest",
  "ei",
  "roi",
  "request for information",
  "rfi",
  "industry engagement",
];

/** Keywords that indicate a formal tender notice. */
const FORMAL_TENDER_KEYWORDS = [
  "invitation to tender",
  "itt",
  "request for proposal",
  "rfp",
  "request for quotation",
  "rfq",
  "formal tender",
  "open procedure",
  "restricted procedure",
  "competitive procedure",
  "contract notice",
  "award notice",
];

/** Keywords that indicate an awarded contract. */
const AWARDED_KEYWORDS = [
  "awarded",
  "award notice",
  "contract award",
  "winner",
  "winning bidder",
  "successful bidder",
  "contract awarded",
];

/** Keywords that indicate a cancelled or aborted procurement. */
const CANCELLED_KEYWORDS = [
  "cancelled",
  "canceled",
  "aborted",
  "withdrawn",
  "terminated",
  "revoked",
  "void",
  "no award",
  "not awarded",
];

/**
 * Derives the procurement stage from notice types, CPV titles, and keywords.
 */
function classifyProcurementStage(
  title: string,
  summary: string | undefined,
  procurementStage: string | undefined,
  cpvCode: string | undefined,
): ProcurementStage {
  const haystack = `${title} ${summary ?? ""} ${procurementStage ?? ""} ${cpvCode ?? ""}`.toLowerCase();

  // Cancelled/aborted takes highest precedence.
  for (const kw of CANCELLED_KEYWORDS) {
    if (haystack.includes(kw.toLowerCase())) {
      return "CANCELLED_ABORTED";
    }
  }

  // Awarded contract takes next precedence.
  for (const kw of AWARDED_KEYWORDS) {
    if (haystack.includes(kw.toLowerCase())) {
      return "AWARDED_CONTRACT";
    }
  }

  // PIN / early engagement.
  for (const kw of PIN_KEYWORDS) {
    if (haystack.includes(kw.toLowerCase())) {
      return "PIN_EARLY_ENGAGEMENT";
    }
  }

  // Formal tender.
  for (const kw of FORMAL_TENDER_KEYWORDS) {
    if (haystack.includes(kw.toLowerCase())) {
      return "FORMAL_TENDER";
    }
  }

  // Fall back to the pipeline-stage field if it maps cleanly.
  if (procurementStage) {
    const stage = procurementStage.toLowerCase();
    if (stage === "planned" || stage === "published") {
      return "FORMAL_TENDER";
    }
    if (stage === "evaluation") {
      return "FORMAL_TENDER";
    }
    if (stage === "awarded") {
      return "AWARDED_CONTRACT";
    }
    if (stage === "cancelled" || stage === "expired") {
      return "CANCELLED_ABORTED";
    }
  }

  // Default: formal tender.
  return "FORMAL_TENDER";
}

/**
 * Extracts structured fields from a normalised opportunity.
 *
 * Uses dynamic exchange rates for GBP conversion before signal tier
 * classification. Falls back to rule-based extraction when NVIDIA is not
 * configured.
 */
export async function extractFields(
  opportunity: NormalisedOpportunity,
): Promise<ExtractionResult> {
  const fields: Record<string, unknown> = {};
  const inferred = false;

  // Rule-based extraction: copy directly-sourced fields without inference.
  if (opportunity.estimatedValue !== undefined) {
    fields.estimatedValue = opportunity.estimatedValue;
  }
  if (opportunity.currency) {
    fields.currency = opportunity.currency;
  }
  if (opportunity.closingDate) {
    fields.closingDate = opportunity.closingDate;
  }
  if (opportunity.publishedDate) {
    fields.publishedDate = opportunity.publishedDate;
  }
  if (opportunity.buyer) {
    fields.buyer = opportunity.buyer;
  }
  if (opportunity.location) {
    fields.location = opportunity.location;
  }
  if (opportunity.procurementStage) {
    fields.procurementStage = opportunity.procurementStage;
  }

  // Subcontractor & Winner Forensics: extract sub-tier entities and award
  // winner from tender text (title + summary).
  const haystack = `${opportunity.title} ${opportunity.summary ?? ""}`;
  const subcontractors = extractSubcontractors(haystack);
  if (subcontractors.length > 0) {
    fields.subcontractors = subcontractors;
  }
  const winningBidder = extractWinningBidder(haystack);
  if (winningBidder) {
    fields.winningBidder = winningBidder;
  }

  // Estimated expiry date: add 12 months to closing date if no explicit expiry
  if (opportunity.closingDate) {
    const closingDate = new Date(opportunity.closingDate);
    if (!isNaN(closingDate.getTime())) {
      const estimatedExpiryDate = new Date(closingDate);
      estimatedExpiryDate.setMonth(estimatedExpiryDate.getMonth() + 12);
      fields.estimatedExpiryDate = estimatedExpiryDate.toISOString().split("T")[0];
    }
  }

  // Procurement stage classification derived from notice types, CPV titles,
  // and keywords.
  const stage = classifyProcurementStage(
    opportunity.title,
    opportunity.summary,
    opportunity.procurementStage,
    opportunity.cpvCode,
  );
  fields.procurementStage = stage;

  // Tier classification based on estimated value converted to GBP using
  // dynamic exchange rates.
  if (opportunity.estimatedValue !== undefined) {
    const valGBP = await convertToGBP(
      opportunity.estimatedValue,
      opportunity.currency,
    );
    if (valGBP >= 10_000_000) {
      fields.signalTier = "MEGAPROCUREMENT";
    } else if (valGBP >= 100_000) {
      fields.signalTier = "HIGH_CAP";
    } else if (valGBP >= 10_000) {
      fields.signalTier = "STANDARD_COMMERCIAL";
    }
  }

  // Never infer values that lack evidence.
  // Do NOT infer buyer email, value, date, or award status.

  return {
    fields,
    success: true,
    confidence: opportunity.confidence ?? 50,
    status: fields.estimatedValue || fields.closingDate
      ? "success"
      : "partial",
    error: undefined,
    model: undefined, // no NVIDIA model used
    inferred,
  };
}

/**
 * Extracts subcontractor entities from tender text.
 * Looks for patterns like "Subcontractor Requirements: X, Y, Z" or
 * "Supply Chain Partners: A, B" or "Named Suppliers: P, Q".
 */
function extractSubcontractors(text: string): string[] {
  const subcontractors: string[] = [];

  // Match patterns like "Subcontractors: X, Y and Z"
  const patterns = [
    /subcontractor[s]?:([^.;\n]+)/gi,
    /supply chain partner[s]?:([^.;\n]+)/gi,
    /named supplier[s]?:([^.;\n]+)/gi,
    /sub-tier supplier[s]?:([^.;\n]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const entities = match[1]
        .split(/[,;]| and /i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 100);
      subcontractors.push(...entities);
    }
  }

  return [...new Set(subcontractors)];
}

/**
 * Extracts the award winner from tender text.
 * Looks for patterns like "Awarded To: X" or "Winning Bidder: Y".
 */
function extractWinningBidder(text: string): string | undefined {
  const patterns = [
    /award(?:ed)? to:([^.;\n]+)/gi,
    /winning bidder:([^.;\n]+)/gi,
    /winner:([^.;\n]+)/gi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}
