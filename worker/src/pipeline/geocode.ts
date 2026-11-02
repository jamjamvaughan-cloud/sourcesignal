/**
 * Regional geocoding helper for ingestion pipeline.
 *
 * Maps regional dockets (cities, states, provinces, countries) mentioned in
 * opportunity records to approximate latitude/longitude float values.
 * This enables the Pro 3D interactive globe map (/dashboard/map) to render
 * opportunity pins without requiring live geocoding API calls.
 *
 * Coverage:
 *   United Kingdom (England, Scotland, Wales, Northern Ireland)
 *   Ireland (Republic of Ireland)
 *   United States (federal + states incl. California)
 *   Canada (federal + provinces incl. British Columbia)
 *
 * Coordinates are approximate city/province centroids, not precise addresses.
 * They are derived from region codes, location fields, and buyer text.
 */

import type { NormalisedOpportunity } from "@/types";

// Regional centroid coordinates (latitude, longitude)
const REGION_COORDS: Record<string, { lat: number; lon: number }> = {
  // United Kingdom
  ENG: { lat: 52.3555, lon: -1.1743 }, // England (Birmingham centroid)
  SCT: { lat: 56.4907, lon: -4.2026 }, // Scotland (central Scotland)
  WLS: { lat: 52.1307, lon: -3.7837 }, // Wales (central Wales)
  NIR: { lat: 54.7877, lon: -6.4923 }, // Northern Ireland
  // Ireland
  IE: { lat: 53.4129, lon: -8.2439 }, // Ireland (central)
  // United States
  US: { lat: 39.8283, lon: -98.5795 }, // US (center)
  CA: { lat: 56.1304, lon: -106.3468 }, // Canada (centroid)
  // Canada
  CN: { lat: 56.1304, lon: -106.3468 }, // Canada (center)
  BC: { lat: 53.7268, lon: -127.6476 }, // British Columbia
  ON: { lat: 51.2538, lon: -85.3232 }, // Ontario
  QC: { lat: 52.9399, lon: -73.5491 }, // Quebec
  AB: { lat: 55.0000, lon: -115.0000 }, // Alberta
  MB: { lat: 53.7609, lon: -98.8139 }, // Manitoba
  SK: { lat: 55.0000, lon: -106.0000 }, // Saskatchewan
  NS: { lat: 44.6820, lon: -63.7443 }, // Nova Scotia
  NB: { lat: 46.5653, lon: -66.4619 }, // New Brunswick
  NL: { lat: 48.9462, lon: -56.8457 }, // Newfoundland and Labrador
  PE: { lat: 46.5107, lon: -63.4168 }, // Prince Edward Island
  YT: { lat: 64.2823, lon: -135.0000 }, // Yukon
  NT: { lat: 64.2668, lon: -124.8220 }, // Northwest Territories
  NU: { lat: 70.2998, lon: -83.1076 }, // Nunavut
};

// City-level coordinates for known procurement hubs
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  // UK cities
  london: { lat: 51.5074, lon: -0.1278 },
  birmingham: { lat: 52.4862, lon: -1.8904 },
  manchester: { lat: 53.4808, lon: -2.2426 },
  glasgow: { lat: 55.8642, lon: -4.2518 },
  edinburgh: { lat: 55.9533, lon: -3.1883 },
  cardiff: { lat: 51.4816, lon: -3.1791 },
  belfast: { lat: 54.5973, lon: -5.9301 },
  leeds: { lat: 53.8008, lon: -1.5491 },
  liverpool: { lat: 53.4084, lon: -2.9916 },
  newcastle: { lat: 54.9783, lon: -1.6178 },
  sheffield: { lat: 53.3811, lon: -1.4701 },
  bristol: { lat: 51.4545, lon: -2.5879 },
  // Ireland cities
  dublin: { lat: 53.3498, lon: -6.2603 },
  cork: { lat: 51.8985, lon: -8.4756 },
  galway: { lat: 53.2707, lon: -9.0568 },
  limerick: { lat: 52.6648, lon: -8.6225 },
  waterford: { lat: 52.2593, lon: -7.1101 },
  // US cities
  washington_dc: { lat: 38.9072, lon: -77.0369 },
  sacramento: { lat: 38.5816, lon: -121.4944 },
  los_angeles: { lat: 34.0522, lon: -118.2437 },
  san_francisco: { lat: 37.7749, lon: -122.4194 },
  san_diego: { lat: 32.7157, lon: -117.1611 },
  new_york: { lat: 40.7128, lon: -74.0060 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  dallas: { lat: 32.7767, lon: -96.7970 },
  // Canada cities
  ottawa: { lat: 45.4215, lon: -75.6972 },
  toronto: { lat: 43.6532, lon: -79.3832 },
  vancouver: { lat: 49.2827, lon: -123.1207 },
  montreal: { lat: 45.5017, lon: -73.5673 },
  calgary: { lat: 51.0447, lon: -114.0719 },
  edmonton: { lat: 53.5444, lon: -113.4909 },
  victoria: { lat: 48.4284, lon: -123.3656 },
  halifax: { lat: 44.6488, lon: -63.5752 },
  winnipeg: { lat: 49.8951, lon: -97.1384 },
};

// Keywords that indicate UK context
const UK_KEYWORDS = [
  "united kingdom", "england", "scotland", "wales", "northern ireland",
  "london", "birmingham", "manchester", "glasgow", "edinburgh", "cardiff",
  "belfast", "leeds", "liverpool", "newcastle", "sheffield", "bristol",
  "mod", "ministry of defence", "uk", "gb",
];

// Keywords that indicate Ireland context
const IE_KEYWORDS = [
  "ireland", "irish", "dublin", "cork", "galway", "limerick", "waterford",
  "uisce éireann", "irish water", "etenders", "ie",
];

// Keywords that indicate US context
const US_KEYWORDS = [
  "united states", "usa", "us", "california", "texas", "new york",
  "washington", "chicago", "dallas", "san francisco", "los angeles",
  "sam.gov", "sam gov", "usa spending", "uscprocure", "caleprocure",
];

// Keywords that indicate Canada context
const CA_KEYWORDS = [
  "canada", "canadian", "british columbia", "ontario", "quebec",
  "alberta", "manitoba", "saskatchewan", "nova scotia", "new brunswick",
  "newfoundland", "prince edward island", "yukon", "northwest territories",
  "nunavut", "vancouver", "toronto", "montreal", "ottawa", "calgary",
  "edmonton", "victoria", "halifax", "winnipeg", "canadabuys", "bc bid",
  "merx", "open canada",
];

function textContains(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function findCityCoords(text: string): { lat: number; lon: number } | null {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    // Match city name as whole word or substring
    if (lower.includes(city)) {
      return coords;
    }
  }
  return null;
}

function findRegionCoords(text: string, region?: string): { lat: number; lon: number } | null {
  // First check explicit region code
  if (region) {
    const upperRegion = region.toUpperCase();
    if (REGION_COORDS[upperRegion]) {
      return REGION_COORDS[upperRegion];
    }
  }

  // Then check text for region names
  const lower = text.toLowerCase();
  for (const [regionCode, coords] of Object.entries(REGION_COORDS)) {
    const regionName = regionCode.toLowerCase();
    if (lower.includes(regionName)) {
      return coords;
    }
  }
  return null;
}

/**
 * Detects the region context from opportunity text (location, buyer, summary).
 * Returns "UK", "IE", "US", or "CA".
 */
function detectRegionContext(text: string): string | null {
  const lower = text.toLowerCase();

  // Check for Ireland first (most specific)
  if (textContains(lower, IE_KEYWORDS)) return "IE";

  // Check for Canada
  if (textContains(lower, CA_KEYWORDS)) return "CA";

  // Check for US
  if (textContains(lower, US_KEYWORDS)) return "US";

  // Check for UK
  if (textContains(lower, UK_KEYWORDS)) return "UK";

  return null;
}

/**
 * Computes approximate latitude/longitude for an opportunity based on its
 * location field, region code, buyer name, and title/summary text.
 *
 * Returns { lat, lon } as floats, or null if no match found.
 */
export function geocodeOpportunity(
  opportunity: Pick<
    NormalisedOpportunity,
    "location" | "region" | "buyer" | "title" | "summary"
  >,
): { lat: number; lon: number } | null {
  const contextText = [
    opportunity.location,
    opportunity.buyer,
    opportunity.title,
    opportunity.summary,
  ]
    .filter(Boolean)
    .join(" ");

  const regionContext = detectRegionContext(contextText);

  // 1. Try city-level coordinates (most precise)
  const cityCoords = findCityCoords(contextText.toLowerCase());
  if (cityCoords) {
    return cityCoords;
  }

  // 2. Try region-level coordinates
  const regionCoords = findRegionCoords(contextText, opportunity.region);
  if (regionCoords) {
    return regionCoords;
  }

  // 3. Fallback to region context centroid
  if (regionContext === "UK") {
    return REGION_COORDS.ENG;
  }
  if (regionContext === "IE") {
    return REGION_COORDS.IE;
  }
  if (regionContext === "US") {
    return REGION_COORDS.US;
  }
  if (regionContext === "CA") {
    return REGION_COORDS.CN;
  }

  return null;
}
