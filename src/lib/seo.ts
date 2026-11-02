/**
 * Institutional SEO / AEO / GEO metadata utilities.
 *
 * Generates structured metadata and JSON-LD schemas for search engines
 * and AI crawlers (Google, Bing, ChatGPT, Claude, Perplexity).
 *
 * All schema.org types follow schema.org specifications:
 * - Organization: Organization identity and contact
 * - Dataset: Procurement opportunity datasets
 * - DataCatalog: Sector and macro-sector catalogs
 * - GovernmentService: Individual tender/procurement records
 */

import { Metadata } from "next";
import { MACRO_SECTORS } from "@/lib/config/sectors";

const SITE_NAME = "SourceSignal";
const SITE_URL = "https://sourcesignal.example.com";
const LOGO_URL = `${SITE_URL}/icon.svg`;
const CONTACT_EMAIL = "admin@example.com";
const CONTACT_PHONE = "+44 20 7946 0958";
const ADDRESS = {
  streetAddress: "10 Downing Street",
  addressLocality: "London",
  addressRegion: "England",
  postalCode: "SW1A 2AA",
  addressCountry: "GB",
};

/**
 * Returns canonical URL for a given path.
 */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * Generates institutional metadata for static pages.
 *
 * Includes Open Graph, Twitter Cards, robots directives, and canonical URL.
 */
export function generateInstitutionalMetadata({
  title,
  description,
  path = "/",
  image,
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
}): Metadata {
  return {
    title: `${title} | SourceSignal`,
    description,
    alternates: {
      canonical: canonicalUrl(path),
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl(path),
      siteName: SITE_NAME,
      type: "website",
      locale: "en_GB",
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      maxSnippet: -1,
      maxImagePreview: "large",
      maxVideoPreview: -1,
    } as Metadata["robots"],
    other: {
      "geo.country": "GB",
      "geo.placename": "London",
      "geo.position": "51.5074;-0.1276",
      "language": "English",
    },
  };
}

/**
 * Generates JSON-LD Organization schema for institutional identity.
 */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    address: {
      "@type": "PostalAddress",
      ...ADDRESS,
    },
    sameAs: [],
    description:
      "Commercial intelligence and procurement SaaS — discover, evaluate and monitor procurement opportunities across supported sectors and regions.",
  };
}

/**
 * Generates JSON-LD Dataset schema for a macro sector dataset.
 */
export function datasetJsonLd({
  macroSector,
  datasetUrl,
  datePublished,
  dateModified,
}: {
  macroSector: {
    id: string;
    name: string;
    description: string;
    subIndustries: readonly { id: string; name: string }[];
  };
  datasetUrl: string;
  datePublished: string;
  dateModified: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${macroSector.name} Procurement Dataset`,
    description: macroSector.description,
    url: datasetUrl,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    creator: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    datePublished,
    dateModified,
    isPartOf: {
      "@type": "DataCatalog",
      name: "SourceSignal Procurement Data Catalog",
      url: canonicalUrl("/dashboard"),
    },
    keywords: macroSector.subIndustries.map((s) => s.name).join(", "),
    isAccessibleForFree: true,
    distribution: [
      {
        "@type": "DataDownload",
        name: `${macroSector.name} Procurement Dataset`,
        description: `Download the ${macroSector.name} procurement dataset in JSON format.`,
        encodingFormat: "application/json",
        contentUrl: datasetUrl,
      },
    ],
  };
}

/**
 * Generates JSON-LD DataCatalog schema for the complete dataset catalog.
 */
export function dataCatalogJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    name: "SourceSignal Procurement Data Catalog",
    description:
      "Commercial intelligence dataset covering procurement opportunities across 15 sub-industries and 6 jurisdictions.",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    dataset: MACRO_SECTORS.map((sector) => ({
      "@type": "Dataset",
      name: `${sector.name} Procurement Dataset`,
      description: sector.description,
      url: canonicalUrl(`/dashboard/opportunities?sector=${sector.id}`),
      keywords: sector.subIndustries.map((s) => s.name).join(", "),
      isAccessibleForFree: true,
    })),
    inLanguage: "en-GB",
    isAccessibleForFree: true,
  };
}

/**
 * Generates JSON-LD GovernmentService schema for a procurement opportunity.
 */
export function governmentServiceJsonLd({
  opportunity,
  baseUrl,
}: {
  opportunity: {
    id: string;
    canonical_id: string;
    title: string;
    buyer: string | null;
    sector: string;
    region: string;
    estimated_value?: number | null;
    currency: string | null;
    procurement_stage: string | null;
    published_date?: string | null;
    closing_date?: string | null;
    source_url: string | null;
    source_hash?: string | null;
    confidence?: number | null;
    summary?: string;
  };
  baseUrl: string;
}): Record<string, unknown> {
  const opportunityUrl = `${baseUrl}/dashboard/opportunities/${opportunity.id}`;

  return {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: opportunity.title,
    description: opportunity.summary ?? `Procurement opportunity for ${opportunity.sector}.`,
    providerLink: opportunity.source_url,
    serviceType: opportunity.procurement_stage
      ? opportunity.procurement_stage
      : "tender",
    serviceStatus: opportunity.procurement_stage
      ? opportunity.procurement_stage
      : "published",
    serviceArea: {
      "@type": "Country",
      name:
        opportunity.region === "ENG" ? "United Kingdom" : opportunity.region,
    },
    serviceProvider: {
      "@type": "Organization",
      name: opportunity.buyer || "Government Authority",
    },
    serviceProviderLocation: {
      "@type": "Place",
      name: opportunity.buyer || "Government Authority",
      address: {
        "@type": "PostalAddress",
        addressLocality:
          opportunity.region === "ENG" ? "England" : opportunity.region,
        addressCountry:
          opportunity.region === "ENG" ? "GB" : opportunity.region,
      },
    },
    sourceHash: opportunity.source_hash,
    sourceUrl: opportunity.source_url,
    confidence: opportunity.confidence ?? null,
    canonicalUrl: opportunityUrl,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    isPartOf: {
      "@type": "DataCatalog",
      name: "SourceSignal Procurement Data Catalog",
      url: canonicalUrl("/dashboard"),
    },
    inLanguage: "en-GB",
    isAccessibleForFree: true,
    recordMetadata: {
      "@type": "RecordMetadata",
      dateModified: new Date().toISOString(),
      version: "1.0.0",
      source: "SourceSignal",
      sourceUrl: `https://sourcesignal.example.com/dashboard/opportunities/${opportunity.id}`,
    },
    "@id": `https://sourcesignal.example.com/dashboard/opportunities/${opportunity.id}`,
  };
}
