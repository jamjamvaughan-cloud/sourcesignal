/**
 * Display constants for the primary sources shown in the dashboard header.
 *
 * This module is intentionally dependency-free so it can be imported by client
 * components without pulling in the database or ingestion runtime.
 */

export const PRIMARY_SOURCES_MONITORED = [
  "GOV.UK Tenders",
  "Planning Permits",
  "Companies House",
  "USAspending",
  "SAM.gov",
  "SEC EDGAR",
  "TED EU",
  "EU Open Data",
] as const;

export const PRIMARY_SOURCES_MONITORED_LABEL = `PRIMARY SOURCES MONITORED: ${PRIMARY_SOURCES_MONITORED.join(
  " | ",
)}`;
