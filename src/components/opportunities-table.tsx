"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronRight, ExternalLink, ShieldCheck, MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatValueForPlan, canViewFullValues } from "@/lib/tier-gating";

export interface Opportunity {
  id: string;
  canonical_id: string;
  title: string;
  buyer?: string | null;
  sector: string;
  region: string;
  location?: string | null;
  estimated_value?: number | null;
  currency?: string | null;
  procurement_stage?: string | null;
  published_date?: string | null;
  closing_date?: string | null;
  confidence?: number | null;
  signal_tier?: string | null;
  source_url?: string | null;
  summary?: string | null;
  is_demonstration?: boolean;
  created?: string | null;
  updated?: string | null;
}

interface SignalDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
}

function SignalDetailsSheet({ open, onOpenChange, opportunity }: SignalDetailsSheetProps) {
  if (!opportunity) return null;
  const isDemo = Boolean(opportunity.is_demonstration);
  const tierColor =
    opportunity.signal_tier === "MEGAPROCUREMENT"
      ? "text-D4AF37 border-D4AF37/20 bg-D4AF37/5"
      : opportunity.signal_tier === "HIGH_CAP"
      ? "text-D4AF37 border-D4AF37/20 bg-D4AF37/5"
      : "text-slate-400 border-white/10 bg-white/5";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger>
        <button className="inline-flex items-center justify-center w-full h-full" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full lg:w-[600px] border border-white/10 bg-[#09090b]/80 backdrop-blur-md max-h-[90vh]">
        <SheetHeader className="pb-4 border-b border-white/5">
          <SheetTitle className="text-xl font-inter font-semibold text-[#E5E5EA] tracking-tight">{opportunity.title}</SheetTitle>
          <SheetDescription className="text-[10px] font-inter font-mono tracking-wider text-slate-500 mt-1">
            Reference: {opportunity.canonical_id}
          </SheetDescription>
          {isDemo && (
            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 border border-D4AF37/30 bg-D4AF37/5">
              <span className="h-1 w-1 bg-D4AF37 rounded-sm" />
              <span className="text-[10px] font-inter font-semibold text-D4AF37 uppercase tracking-tighter">Demonstration Data</span>
            </div>
          )}
        </SheetHeader>
        <div className="divide-y divide-white/5 p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Sector</p>
              <p className="text-sm font-inter font-medium text-[#E5E5EA] capitalize">{opportunity.sector}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Region</p>
              <span className={`text-[10px] font-inter font-semibold px-2.5 py-0.5 rounded-sm border ${SECTOR_STYLES[opportunity.sector] || SECTOR_STYLES.default}`}>
                {opportunity.region}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Stage</p>
              <span className={`text-[10px] font-inter font-semibold ${tierColor}`}>
                {opportunity.procurement_stage ? opportunity.procurement_stage.charAt(0).toUpperCase() + opportunity.procurement_stage.slice(1) : "Published"}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Match Score</p>
              <span className={`text-[10px] font-inter font-semibold ${tierColor}`}>
                {opportunity.signal_tier?.replace(/_/g, " ") || "Standard"}
              </span>
            </div>
          </div>
          {opportunity.estimated_value != null && (
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">CapEx Value</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-inter font-bold text-[#E5E5EA] font-mono tabular-nums">£{Number(opportunity.estimated_value).toLocaleString()}</span>
                <span className="text-sm font-inter text-slate-400 font-mono tabular-nums">{opportunity.currency || "GBP"}</span>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Timeline</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <p className="text-[10px] font-inter font-mono text-slate-500 uppercase">Published</p>
                <p className="text-sm font-inter font-mono text-slate-300 tabular-nums">{opportunity.published_date ? new Date(opportunity.published_date).toLocaleDateString() : "—"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-inter font-mono text-slate-500 uppercase">Closing</p>
                <p className="text-sm font-inter font-mono text-slate-300 tabular-nums">{opportunity.closing_date ? new Date(opportunity.closing_date).toLocaleDateString() : "—"}</p>
              </div>
            </div>
          </div>
          {opportunity.location && (
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Location</p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-inter text-slate-300">{opportunity.location}</p>
              </div>
            </div>
          )}
          {opportunity.summary && (
            <div className="space-y-1">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Summary</p>
              <p className="text-sm font-inter text-slate-300 leading-relaxed">{opportunity.summary}</p>
            </div>
          )}
          {opportunity.source_url && (
            <div className="space-y-1 pt-3 border-t border-white/5">
              <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Source Notice</p>
              <a href={opportunity.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-inter font-medium text-D4AF37 hover:text-D4AF37/80 hover:underline transition-colors">
                <ExternalLink className="h-4 w-4" /> View Source Notice
              </a>
              <p className="mt-1 text-[10px] font-inter text-slate-500">Source provenance preserved for traceability.</p>
            </div>
          )}
        </div>
        <SheetFooter className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px]">
              <ShieldCheck className="h-3 w-3 text-D4AF37" />
              <span className="font-inter text-slate-400">Source verified</span>
            </div>
            <Button variant="outline" size="sm" className="w-24 border-white/10 text-slate-400 hover:text-white hover:bg-white/5">Close</Button>
          </div>
        </SheetFooter>
        <SheetClose className="absolute top-4 right-4" />
      </SheetContent>
    </Sheet>
  );
}

const SECTOR_STYLES: Record<string, string> = {
  Infrastructure: "bg-white/5 text-slate-300 border border-white/10",
  Energy: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Defence: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Technology: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Construction: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Logistics: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Manufacturing: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Healthcare: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  default: "bg-white/5 text-slate-300 border border-white/10",
};

function formatCapEx(value: number | null | undefined, currency: string | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000_000) return `£${(value / 1_000_000_000).toFixed(1)}B ${currency || "GBP"}`;
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M ${currency || "GBP"}`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(1)}K ${currency || "GBP"}`;
  return `£${value.toFixed(0)} ${currency || "GBP"}`;
}

const NOW = new Date("2026-10-30").getTime();

export function OpportunitiesTable({
  opportunities,
  planId = "free",
}: {
  opportunities: Opportunity[];
  planId?: "free" | "pro";
}) {
  const [selectedOpportunity, setSelectedOpportunity] = React.useState<Opportunity | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const canFullValues = canViewFullValues(planId);

  const handleRowClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setDrawerOpen(true);
  };

  const displayOpportunities = opportunities;

  if (displayOpportunities.length === 0) {
    return (
      <EmptyState
        title="No tenders found"
        description="No active tenders match your current filters. Try adjusting the sector, region, or stage filters."
      />
    );
  }

  return (
    <>
      <div className="glass-card overflow-hidden section-enter max-w-full min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-[#0F0F11]">
              <tr className="border-b border-white/5 sticky top-0 z-10">
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 w-10">Status</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Tender Title &amp; Buyer</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Sector</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Region</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right">CapEx Value</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right">Closes In</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right">Match %</th>
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayOpportunities.map((opp) => {
                const sectorStyle = SECTOR_STYLES[opp.sector] || SECTOR_STYLES.default;
                const value = formatCapEx(opp.estimated_value, opp.currency);
                const closingDays = opp.closing_date
                  ? Math.ceil((new Date(opp.closing_date).getTime() - NOW) / 86400000)
                  : null;
                const matchPct = opp.confidence ?? (opp.signal_tier === "MEGAPROCUREMENT" ? 94 : opp.signal_tier === "HIGH_CAP" ? 89 : 82);

                return (
                  <tr
                    key={opp.id}
                    onClick={() => handleRowClick(opp)}
                    className="table-row cursor-pointer group hover:bg-white/5 transition-all duration-200 ease-out"
                  >
                    <td className="px-4 py-3">
                      <span className={`flex h-6 w-6 items-center justify-center text-[10px] font-bold ${opp.signal_tier === "MEGAPROCUREMENT" || opp.signal_tier === "HIGH_CAP" ? "bg-D4AF37 text-[#09090b]" : opp.signal_tier === "STANDARD_COMMERCIAL" ? "bg-white/10 text-white" : "bg-white/5 text-slate-400"}`}>
                        {opp.canonical_id.slice(-2).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-inter font-semibold text-[#E5E5EA] group-hover:text-D4AF37/80 transition-colors">{opp.title}</p>
                        {opp.buyer && (
                          <p className="text-[10px] font-inter font-mono text-slate-400 tabular-nums">{opp.buyer}</p>
                        )}
                        <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">{opp.created ? new Date(opp.created).toLocaleDateString("en-GB") : "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-inter font-mono ${sectorStyle}`}>
                        {opp.sector}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-sm font-inter font-mono text-slate-400 tabular-nums">{opp.region}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-sm font-inter font-bold text-[#E5E5EA] font-mono tabular-nums">{canFullValues ? value : formatValueForPlan(opp.estimated_value, opp.currency, planId)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-inter font-mono text-D4AF37 tabular-nums">{closingDays !== null ? `${closingDays}d left` : "—"}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-inter font-mono font-bold text-[#E5E5EA] tabular-nums">{matchPct}%</span></td>
                    <td className="px-4 py-3 text-right"><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-D4AF37 transition-colors" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <SignalDetailsSheet open={drawerOpen} onOpenChange={setDrawerOpen} opportunity={selectedOpportunity} />
    </>
  );
}
