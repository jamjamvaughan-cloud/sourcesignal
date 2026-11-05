import { entitlementsFor } from "@/lib/entitlements";
import { backendJson, getSessionContext } from "@/lib/backend";
import { notFound } from "next/navigation";
import { ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { extractBuyerEmails } from "@/lib/nvidia";
import { governmentServiceJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

interface OpportunityRecord {
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
  summary?: string | null;
  location?: string | null;
  winningBidder?: string | null;
  subcontractors?: string | null;
  is_demonstration?: boolean;
}

function str(val: unknown): string {
  return val == null ? "" : String(val);
}

async function fetchOpportunity(id: string): Promise<OpportunityRecord | null> {
  const result = await backendJson<{ opportunity?: OpportunityRecord }>(
    `/api/opportunities/${encodeURIComponent(id)}`,
  );
  return result?.opportunity ?? null;
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);

  if (!opportunity) {
    return {
      title: "Opportunity Not Found | SourceSignal",
    };
  }

  return {
    title: `${opportunity.title} | SourceSignal`,
    description:
      opportunity.summary ?? `Procurement opportunity for ${opportunity.sector}.`,
    alternates: {
      canonical: `https://sourcesignal.example.com/dashboard/opportunities/${id}`,
    },
    openGraph: {
      title: opportunity.title,
      description:
        opportunity.summary ?? `Procurement opportunity for ${opportunity.sector}.`,
      url: `https://sourcesignal.example.com/dashboard/opportunities/${id}`,
      siteName: "SourceSignal",
      type: "website",
    },
  };
}

export default async function OpportunityDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { planId } = await getSessionContext();
  const entitlements = entitlementsFor(planId);
  const opportunity = await fetchOpportunity(id);

  if (!opportunity) {
    notFound();
  }

  const isDemonstration = Boolean(opportunity.is_demonstration);

  const jsonLd = governmentServiceJsonLd({
    opportunity: {
      ...opportunity,
      summary: opportunity.summary as string | undefined,
    },
    baseUrl: "https://sourcesignal.example.com",
  });

  return (
    <>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <div className="space-y-8 section-enter max-w-full min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
          <div>
            <h1 className="headline mb-0.5">{str(opportunity.title)}</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
              Tender detail and source traceability.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isDemonstration && (
              <span className="flex items-center gap-1 px-2.5 py-1 border border-D4AF37/30 bg-D4AF37/5 rounded-sm">
                <AlertTriangle className="h-3 w-3 text-D4AF37" aria-hidden="true" />
                <span className="text-[10px] font-inter font-semibold text-D4AF37 uppercase tracking-tighter">
                  Demonstration Data
                </span>
              </span>
            )}
            <div className="flex items-center gap-1 px-2.5 py-1 border border-D4AF37/30 bg-D4AF37/5 rounded-sm">
              <ShieldCheck className="h-3 w-3 text-D4AF37" aria-hidden="true" />
              <span className="text-[10px] font-inter font-semibold text-D4AF37 uppercase tracking-tighter">
                Source Verified
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-3">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Summary
              </div>
              <p className="text-[10px] font-inter text-slate-400 leading-relaxed">
                {str(opportunity.summary) || "No summary available for this tender."}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Tender Details
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Buyer
                  </span>
                  <span className="text-sm font-inter text-[#E5E5EA]">
                    {str(opportunity.buyer) || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Sector
                  </span>
                  <span className="text-sm font-inter text-[#E5E5EA]">
                    {str(opportunity.sector)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Region
                  </span>
                  <span className="text-sm font-inter text-[#E5E5EA]">
                    {str(opportunity.region)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Location
                  </span>
                  <span className="text-sm font-inter text-[#E5E5EA]">
                    {str(opportunity.location) || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Stage
                  </span>
                  <span className="text-sm font-inter text-[#E5E5EA]">
                    {str(opportunity.procurement_stage) || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Published
                  </span>
                  <span className="text-sm font-inter text-white font-mono tabular-nums">
                    {str(opportunity.published_date) || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Closing Date
                  </span>
                  <span className="text-sm font-inter text-white font-mono tabular-nums">
                    {str(opportunity.closing_date) || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Source Provenance
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Source Hash
                  </span>
                  <span className="text-sm font-inter text-white font-mono tabular-nums">
                    {str(opportunity.source_hash) || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Source URL
                  </span>
                  <span className="text-sm font-inter text-white font-mono truncate max-w-[200px] tabular-nums">
                    {str(opportunity.source_url) || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 bg-D4AF37 rounded-sm" />
                  <span className="text-[10px] font-inter font-semibold text-D4AF37 uppercase tracking-tighter">
                    Verified — SHA-256 Match
                  </span>
                </div>
                <p className="text-[10px] font-inter text-slate-500 mt-1">
                  Source provenance preserved for traceability.
                </p>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Supply Chain Intelligence
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Winning Bidder
                  </span>
                  <span className="text-sm font-inter text-white font-mono tabular-nums">
                    {str(opportunity.winningBidder) || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[10px] font-inter font-mono text-slate-500 uppercase tabular-nums">
                    Subcontractors
                  </span>
                  <span className="text-sm font-inter text-white font-mono tabular-nums">
                    {str(opportunity.subcontractors) || "—"}
                  </span>
                </div>
                <p className="text-[10px] font-inter text-slate-500 mt-1">
                  Extracted from tender text. Identify supply chain partners and award winners for B2B outreach.
                </p>
              </div>
            </div>

            {entitlements.fullDetailsEnabled && opportunity.estimated_value !== undefined && (
              <div className="glass-card p-4">
                <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Valuation Estimate
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-inter font-bold text-[#E5E5EA] font-mono tabular-nums">
                    {Number(opportunity.estimated_value) || 0} {str(opportunity.currency) || "GBP"}
                  </span>
                  <span className="text-[10px] font-inter text-slate-500">
                    Estimate only — verify against source
                  </span>
                </div>
              </div>
            )}

            {!entitlements.fullDetailsEnabled && (
              <div className="glass-card p-4">
                <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Valuation Estimate
                </div>
                <p className="text-[10px] font-inter text-slate-500">
                  Valuation estimates are available on Pro. Upgrade to view full details.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-3">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Source
              </div>
              {opportunity.source_url ? (
                <a
                  href={str(opportunity.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-inter font-medium text-D4AF37 hover:text-D4AF37/80 hover:underline transition-colors"
                >
                  <ExternalLink className="h-4 w-4" /> View Source Notice
                </a>
              ) : (
                <p className="text-[10px] font-inter text-slate-500">
                  No source URL available.
                </p>
              )}
            </div>

            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Traceability
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-D4AF37 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-sm font-inter text-[#E5E5EA]">
                      Source Hash Recorded
                    </p>
                    <p className="text-[10px] font-inter text-slate-500">
                      SHA-256 provenance preserved for traceability.
                    </p>
                  </div>
                </div>
                {isDemonstration && (
                  <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                    <AlertTriangle className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-inter text-slate-500">Demonstration Record</p>
                      <p className="text-[10px] font-inter text-slate-500">
                        This is sample data for development only.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {entitlements.buyerEmailsEnabled && String(opportunity.buyer || "") && (
              <div className="glass-card p-4">
                <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Buyer Contact Classification
                </div>
                <div className="space-y-2">
                  {(() => {
                    const classifications = extractBuyerEmails(
                      String(opportunity.buyer ?? ""),
                    );
                    if (classifications.length === 0) {
                      return (
                        <div className="text-[10px] font-inter text-slate-500">
                          No buyer email detected in source text.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {classifications.map((e) => (
                          <div
                            key={e.email}
                            className="flex items-center gap-2 text-sm p-2 border border-white/5 bg-white/5 rounded-sm"
                          >
                            <span className="text-xs font-inter font-mono text-white truncate w-48 tabular-nums">
                              {e.email}
                            </span>
                            <span
                              className={`text-[9px] font-inter font-bold uppercase tracking-tighter px-2 py-0.5 rounded-sm ${e.type === "direct_decision_maker" ? "bg-D4AF37 text-[#09090b]" : "border border-white/10 text-slate-400"}`}
                            >
                              {e.type === "direct_decision_maker"
                                ? "DIRECT DECISION MAKER"
                                : "GENERAL INBOX"}
                            </span>
                            <span className="text-xs font-inter text-slate-500 font-mono tabular-nums ml-2">
                              {e.domain}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {!entitlements.buyerEmailsEnabled && (
              <div className="glass-card p-4">
                <p className="text-[10px] font-inter text-slate-500">
                  Buyer contact details are available on Pro where lawfully available.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
