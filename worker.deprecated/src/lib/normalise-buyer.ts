/**
 * Canonical Buyer Entity Resolution.
 *
 * Normalizes fragmented public sector buyer names into unified canonical
 * identifiers (e.g., "MoD UK", "Ministry of Defence", "DE&S" → "uk-mod").
 * This ensures competitive density and spending velocity analyses group all
 * awards for the same buyer regardless of naming variations across sources.
 */

/** Mapping of buyer name fragments to canonical buyer IDs. */
const BUYER_CANONICAL_MAP: Record<string, {
  buyerCanonicalId: string;
  buyerCanonicalName: string;
}> = {
  // United Kingdom — Ministry of Defence
  "ministry of defence": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },
  "mod uk": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },
  "mod": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },
  "de&s": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },
  "defence equipment and support": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },
  "defence equipment & support": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },
  "uk defence": { buyerCanonicalId: "uk-mod", buyerCanonicalName: "UK Ministry of Defence" },

  // United Kingdom — NHS
  "nhs": { buyerCanonicalId: "uk-nhs", buyerCanonicalName: "UK National Health Service" },
  "national health service": { buyerCanonicalId: "uk-nhs", buyerCanonicalName: "UK National Health Service" },
  "nhs england": { buyerCanonicalId: "uk-nhs", buyerCanonicalName: "UK National Health Service" },
  "nhs scotland": { buyerCanonicalId: "uk-nhs-scotland", buyerCanonicalName: "NHS Scotland" },
  "nhs wales": { buyerCanonicalId: "uk-nhs-wales", buyerCanonicalName: "NHS Wales" },
  "nhs northern ireland": { buyerCanonicalId: "uk-nhs-northern-ireland", buyerCanonicalName: "NHS Northern Ireland" },

  // United Kingdom — Department for Transport
  "department for transport": { buyerCanonicalId: "uk-dft", buyerCanonicalName: "UK Department for Transport" },
  "dft": { buyerCanonicalId: "uk-dft", buyerCanonicalName: "UK Department for Transport" },
  "national highways": { buyerCanonicalId: "uk-national-highways", buyerCanonicalName: "National Highways" },
  "network rail": { buyerCanonicalId: "uk-network-rail", buyerCanonicalName: "Network Rail" },

  // United Kingdom — HMRC / Treasury
  "hmrc": { buyerCanonicalId: "uk-hmrc", buyerCanonicalName: "HM Revenue & Customs" },
  "hm revenue & customs": { buyerCanonicalId: "uk-hmrc", buyerCanonicalName: "HM Revenue & Customs" },
  "hm treasury": { buyerCanonicalId: "uk-hm-treasury", buyerCanonicalName: "HM Treasury" },

  // United States — Federal
  "department of defense": { buyerCanonicalId: "us-dod", buyerCanonicalName: "US Department of Defense" },
  "department of defence": { buyerCanonicalId: "us-dod", buyerCanonicalName: "US Department of Defense" },
  "dod": { buyerCanonicalId: "us-dod", buyerCanonicalName: "US Department of Defense" },
  "department of veterans affairs": { buyerCanonicalId: "us-va", buyerCanonicalName: "US Department of Veterans Affairs" },
  "va": { buyerCanonicalId: "us-va", buyerCanonicalName: "US Department of Veterans Affairs" },
  "general services administration": { buyerCanonicalId: "us-gsa", buyerCanonicalName: "US General Services Administration" },
  "gsa": { buyerCanonicalId: "us-gsa", buyerCanonicalName: "US General Services Administration" },
  "department of homeland security": { buyerCanonicalId: "us-dhs", buyerCanonicalName: "US Department of Homeland Security" },
  "dhs": { buyerCanonicalId: "us-dhs", buyerCanonicalName: "US Department of Homeland Security" },
  "department of transportation": { buyerCanonicalId: "us-dot", buyerCanonicalName: "US Department of Transportation" },
  "dot": { buyerCanonicalId: "us-dot", buyerCanonicalName: "US Department of Transportation" },
  "department of energy": { buyerCanonicalId: "us-doe", buyerCanonicalName: "US Department of Energy" },
  "doe": { buyerCanonicalId: "us-doe", buyerCanonicalName: "US Department of Energy" },
  "department of health and human services": { buyerCanonicalId: "us-hhs", buyerCanonicalName: "US Department of Health & Human Services" },
  "hhs": { buyerCanonicalId: "us-hhs", buyerCanonicalName: "US Department of Health & Human Services" },

  // Canada — Federal
  "public services and procurement canada": { buyerCanonicalId: "ca-pspc", buyerCanonicalName: "Public Services and Procurement Canada" },
  "pspc": { buyerCanonicalId: "ca-pspc", buyerCanonicalName: "Public Services and Procurement Canada" },
  "canada buys": { buyerCanonicalId: "ca-pspc", buyerCanonicalName: "Public Services and Procurement Canada" },
  "health canada": { buyerCanonicalId: "ca-health-canada", buyerCanonicalName: "Health Canada" },
  "transport canada": { buyerCanonicalId: "ca-transport-canada", buyerCanonicalName: "Transport Canada" },

  // Ireland
  "office of government procurement": { buyerCanonicalId: "ie-ogp", buyerCanonicalName: "Ireland Office of Government Procurement" },
  "ogp": { buyerCanonicalId: "ie-ogp", buyerCanonicalName: "Ireland Office of Government Procurement" },
  "irish water": { buyerCanonicalId: "ie-irish-water", buyerCanonicalName: "Irish Water / Uisce Éireann" },
  "uisce éireann": { buyerCanonicalId: "ie-irish-water", buyerCanonicalName: "Irish Water / Uisce Éireann" },
  "uisce eireann": { buyerCanonicalId: "ie-irish-water", buyerCanonicalName: "Irish Water / Uisce Éireann" },
  "eirgrid": { buyerCanonicalId: "ie-eirgrid", buyerCanonicalName: "EirGrid" },
  "transport infrastructure ireland": { buyerCanonicalId: "ie-tii", buyerCanonicalName: "Transport Infrastructure Ireland" },
  "tii": { buyerCanonicalId: "ie-tii", buyerCanonicalName: "Transport Infrastructure Ireland" },

  // Australia — Defence (using au- prefix to avoid collision with US DoD)
  "australian department of defence": { buyerCanonicalId: "au-defence", buyerCanonicalName: "Australian Department of Defence" },
  "defence australia": { buyerCanonicalId: "au-defence", buyerCanonicalName: "Australian Department of Defence" },
  "services australia": { buyerCanonicalId: "au-services-australia", buyerCanonicalName: "Services Australia" },
  "australian taxation office": { buyerCanonicalId: "au-ato", buyerCanonicalName: "Australian Taxation Office" },
  "ato": { buyerCanonicalId: "au-ato", buyerCanonicalName: "Australian Taxation Office" },

  // European Union
  "european defence agency": { buyerCanonicalId: "eu-eda", buyerCanonicalName: "European Defence Agency" },
  "eda": { buyerCanonicalId: "eu-eda", buyerCanonicalName: "European Defence Agency" },
  "european commission": { buyerCanonicalId: "eu-ec", buyerCanonicalName: "European Commission" },
  "ec": { buyerCanonicalId: "eu-ec", buyerCanonicalName: "European Commission" },
};

/**
 * Resolves a buyer name to a canonical buyer ID.
 *
 * Performs case-insensitive substring matching against known buyer name
 * fragments. Returns the canonical ID and normalized name, or null if no
 * match is found.
 */
export function resolveBuyer(
  buyerName: string | undefined | null,
): { buyerCanonicalId: string; buyerCanonicalName: string } | null {
  if (!buyerName) return null;

  const normalized = buyerName.toLowerCase().trim();

  // Try exact match first.
  if (BUYER_CANONICAL_MAP[normalized]) {
    return BUYER_CANONICAL_MAP[normalized];
  }

  // Try substring match (longest match wins).
  let bestMatch: {
    buyerCanonicalId: string;
    buyerCanonicalName: string;
  } | null = null;
  let bestMatchLength = 0;

  for (const [fragment, mapping] of Object.entries(BUYER_CANONICAL_MAP)) {
    if (
      normalized.includes(fragment.toLowerCase()) &&
      fragment.length > bestMatchLength
    ) {
      bestMatch = mapping;
      bestMatchLength = fragment.length;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  return null;
}

/**
 * Resolves a buyer name to just its canonical ID.
 */
export function resolveBuyerId(
  buyerName: string | undefined | null,
): string | null {
  const result = resolveBuyer(buyerName);
  return result ? result.buyerCanonicalId : null;
}

/**
 * Returns all registered canonical buyer IDs.
 */
export function getAllCanonicalBuyerIds(): string[] {
  return Object.values(BUYER_CANONICAL_MAP).map(
    (m) => m.buyerCanonicalId,
  );
}

/**
 * Returns the canonical name for a buyer ID, or null if unknown.
 */
export function getCanonicalBuyerName(buyerCanonicalId: string): string | null {
  const entry = Object.values(BUYER_CANONICAL_MAP).find(
    (m) => m.buyerCanonicalId === buyerCanonicalId,
  );
  return entry ? entry.buyerCanonicalName : null;
}
