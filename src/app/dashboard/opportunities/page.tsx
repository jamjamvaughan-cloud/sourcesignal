"use client";

/**
 * Corporate Explorer — Opportunity Search Page.
 *
 * Rightmove-inspired search command header with:
 *   - Country, Industry, Sub-Category dropdown filters
 *   • Classic Filter vs AI Intent Mode toggle
 *   • Mode tabs: Pre-RFP Tenders, Incumbent Fatigue, Expansion Triggers
 *   • Watched Accounts & Saved Signal Queries shortcuts
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { InspectorDrawer, type InspectorData } from "@/components/inspector-drawer";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface Opportunity {
  id: string;
  canonical_id: string;
  title: string;
  buyer?: string | null;
  sector: string;
  region: string;
  country?: string | null;
  location?: string | null;
  estimated_value?: number | null;
  currency?: string | null;
  procurement_stage?: string | null;
  published_date?: string | null;
  closing_date?: string | null;
  confidence?: number | null;
  signal_tier?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  source_captured_at?: string | null;
  source_hash?: string | null;
  summary?: string | null;
  is_demonstration?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  vulnerability_trigger?: string | null;
  opportunity_type?: string | null;
  opportunity_score?: number | null;
  commercial_why?: string | null;
  supplier_capabilities?: string[] | null;
  sub_category?: string | null;
}

const MODES = [
  { id: "prerfp", label: "Pre-RFP Tenders", description: "Early-stage procurement before formal publication" },
  { id: "incumbent", label: "Incumbent Fatigue", description: "Buyers showing churn signals and renewal risk" },
  { id: "expansion", label: "Expansion Triggers", description: "CAPEX projects and facility growth signals" },
] as const;

type ModeId = (typeof MODES)[number]["id"];

const NOW = new Date("2026-11-03").getTime();

const SECTOR_STYLES: Record<string, string> = {
  "technology-infrastructure": "bg-white/5 text-D4AF37 border border-D4AF37/20",
  energy: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  construction: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  "healthcare-infrastructure": "bg-white/5 text-D4AF37 border border-D4AF37/20",
  transport: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  "logistics-and-distribution": "bg-white/5 text-D4AF37 border border-D4AF37/20",
  "public-sector-services": "bg-white/5 text-D4AF37 border border-D4AF37/20",
  default: "bg-white/5 text-slate-300 border border-white/10",
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<InspectorData | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [mode, setMode] = React.useState<ModeId>("prerfp");
  const [filterMode, setFilterMode] = React.useState<"classic" | "ai">("classic");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [countryFilter, setCountryFilter] = React.useState<string>("");
  const [industryFilter, setIndustryFilter] = React.useState<string>("");

  React.useEffect(() => {
    async function fetchOpportunities() {
      try {
        const params = new URLSearchParams({
          page: "1",
          perPage: "50",
          sort: "-created_at",
        });
        if (countryFilter) params.set("country", countryFilter);
        if (industryFilter) params.set("sector", industryFilter);
        if (searchQuery) params.set("q", searchQuery);

        const res = await fetch(`${API_URL}/api/opportunities?${params}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setOpportunities((data.items || []).map(normalize));
        }
      } catch {
        setOpportunities([]);
      } finally {
        setLoading(false);
      }
    }
    fetchOpportunities();
  }, [countryFilter, industryFilter, searchQuery]);

  const handleOpenInspector = (id: string) => {
    setSelected(null);
    setDrawerOpen(true);
    // Fetch the specific opportunity
    const opp = opportunities.find((o) => o.canonical_id === id || o.id === id);
    if (opp) {
      setSelected(normalizeInspector(opp));
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-[10px] font-inter font-mono text-slate-400 animate-pulse">
          Loading signals…
        </p>
      </div>
    );
  }

  const filtered = opportunities.filter((opp) => {
    if (countryFilter && opp.region !== countryFilter && opp.country !== countryFilter) return false;
    if (industryFilter && opp.sector !== industryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!opp.title?.toLowerCase().includes(q) &&
          !opp.buyer?.toLowerCase().includes(q) &&
          !opp.summary?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No opportunities found"
        description="No active tenders match your current filters."
      />
    );
  }

  return (
    <>
      {/* Search Command Header */}
      <div className="space-y-6 section-enter max-w-full min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
          <div>
            <h1 className="headline mb-0.5">Corporate Explorer</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
              Commercial displacement intelligence
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              className="text-[10px] font-inter font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 ease-out px-4 py-2 rounded-xl"
              onClick={() => {
                setCountryFilter("");
                setIndustryFilter("");
                setSearchQuery("");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search title, buyer, sector…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 text-xs pl-10 pr-3 w-full bg-transparent border-transparent text-white placeholder-slate-500 focus:border-D4AF37 focus:ring-0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={countryFilter || "all"}
                onValueChange={(v) => setCountryFilter(v === null || v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 text-xs px-3 min-w-[150px] w-auto bg-transparent border-transparent text-white focus:border-D4AF37 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="p-2 bg-[#09090b] border border-white/10">
                  <SelectItem value="all">Country</SelectItem>
                  {["UK", "US", "CA", "IE", "AU", "EU"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={industryFilter || "all"}
                onValueChange={(v) => setIndustryFilter(v === null || v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 text-xs px-3 min-w-[200px] w-auto bg-transparent border-transparent text-white focus:border-D4AF37 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="p-2 bg-[#09090b] border border-white/10">
                  <SelectItem value="all">Industry</SelectItem>
                  {[
                    { id: "technology-infrastructure", label: "Technology Infrastructure" },
                    { id: "energy", label: "Energy" },
                    { id: "construction", label: "Construction" },
                    { id: "healthcare-infrastructure", label: "Healthcare Infrastructure" },
                    { id: "transport", label: "Transport" },
                    { id: "logistics-and-distribution", label: "Logistics & Distribution" },
                    { id: "public-sector-services", label: "Public Sector Services" },
                  ].map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-1 text-[9px] font-inter font-mono text-slate-500">
              Classic Filter
              <button
                onClick={() => setFilterMode("classic")}
                className={`ml-1 h-5 w-5 rounded text-[9px] transition-all ${filterMode === "classic" ? "bg-D4AF37 text-[#09090b]" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="3"/></svg>
              </button>
              <button
                onClick={() => setFilterMode("ai")}
                className={`ml-1 h-5 w-5 rounded text-[9px] transition-all ${filterMode === "ai" ? "bg-D4AF37 text-[#09090b]" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-2 text-[9px] font-inter font-bold rounded-xl transition-all ${
                mode === m.id
                  ? "bg-D4AF37 text-[#09090b] shadow-lg shadow-D4AF37/30"
                  : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="glass-card overflow-hidden section-enter max-w-full min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-[#0F0F11]">
              <tr className="border-b border-white/5 sticky top-0 z-10">
                <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 w-10">ID</th>
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
              {filtered.map((opp) => {
                const sectorStyle =
                  SECTOR_STYLES[opp.sector] || SECTOR_STYLES.default;
                const value = formatCapEx(
                  opp.estimated_value,
                  opp.currency,
                );
                const closingDays = opp.closing_date
                  ? Math.ceil(
                      (new Date(opp.closing_date).getTime() - NOW) /
                        86400000,
                    )
                  : null;
                const matchPct =
                  opp.confidence ??
                  (opp.signal_tier === "MEGAPROCUREMENT"
                    ? 94
                    : opp.signal_tier === "HIGH_CAP"
                      ? 89
                      : 82);

                return (
                  <tr
                    key={opp.id}
                    onClick={() => handleOpenInspector(opp.canonical_id)}
                    className="table-row cursor-pointer group hover:bg-white/5 transition-all duration-200 ease-out"
                  >
                    <td className="px-4 py-3">
                      <span className={`flex h-6 w-6 items-center justify-center text-[10px] font-bold ${opp.signal_tier === "MEGAPROCUREMENT" || opp.signal_tier === "HIGH_CAP" ? "bg-D4AF37 text-[#09090b]" : opp.signal_tier === "STANDARD_COMMERCIAL" ? "bg-white/10 text-white" : "bg-white/5 text-slate-400"}`}>
                        {opp.canonical_id.slice(-2).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-inter font-semibold text-[#E5E5EA] group-hover:text-D4AF37/80 transition-colors">
                          {opp.title}
                        </p>
                        {opp.buyer && (
                          <p className="text-[10px] font-inter font-mono text-slate-400 tabular-nums">
                            {opp.buyer}
                          </p>
                        )}
                        <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">
                          {opp.created_at
                            ? new Date(opp.created_at).toLocaleDateString("en-GB")
                            : "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-inter font-mono ${sectorStyle}`}>
                        {opp.sector}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-inter font-mono text-slate-400 tabular-nums">
                        {opp.region}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {opp.vulnerability_trigger ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-inter font-bold ${getVulnerabilityStyle(opp.vulnerability_trigger)}`}>
                          {opp.vulnerability_trigger}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-inter font-bold text-[#E5E5EA] font-mono tabular-nums">
                        {value}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-inter font-mono text-D4AF37 tabular-nums">
                        {closingDays !== null ? `${closingDays}d left` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-inter font-mono font-bold text-[#E5E5EA] tabular-nums">
                        {matchPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-D4AF37 transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <InspectorDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        inspector={selected}
      />
    </>
  );
}

function getVulnerabilityStyle(trigger: string): string {
  const styles: Record<string, string> = {
    "Legacy System EOL": "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    "Vendor Price Surge": "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    "CAPEX Expansion": "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    "Planning Approval Stage 2": "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  };
  return styles[trigger] || "bg-slate-500/10 text-slate-400 border border-slate-500/20";
}

function formatCapEx(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value == null) return "—";
  if (value >= 1_000_000_000)
    return `£${(value / 1_000_000_000).toFixed(1)}B ${currency || "GBP"}`;
  if (value >= 1_000_000)
    return `£${(value / 1_000_000).toFixed(1)}M ${currency || "GBP"}`;
  if (value >= 1_000)
    return `£${(value / 1_000).toFixed(1)}K ${currency || "GBP"}`;
  return `£${value.toFixed(0)} ${currency || "GBP"}`;
}

function normalize(opp: Record<string, unknown>): Opportunity {
  return {
    id: String(opp.id ?? ""),
    canonical_id: String(opp.canonical_id ?? ""),
    title: String(opp.title ?? ""),
    buyer: opp.buyer as string | null ?? null,
    sector: String(opp.sector ?? ""),
    region: String(opp.region ?? ""),
    location: opp.location as string | null ?? null,
    estimated_value: opp.estimated_value as number | null ?? null,
    currency: opp.currency as string | null ?? null,
    procurement_stage: opp.procurement_stage as string | null ?? null,
    published_date: opp.published_date as string | null ?? null,
    closing_date: opp.closing_date as string | null ?? null,
    confidence: opp.confidence as number | null ?? null,
    signal_tier: opp.signal_tier as string | null ?? null,
    source_url: opp.source_url as string | null ?? null,
    source_name: opp.source_name as string | null ?? null,
    source_captured_at: opp.source_captured_at as string | null ?? null,
    source_hash: opp.source_hash as string | null ?? null,
    summary: opp.summary as string | null ?? null,
    is_demonstration: Boolean(opp.is_demonstration),
    created_at: opp.created_at as string | null ?? null,
    updated_at: opp.updated_at as string | null ?? null,
    vulnerability_trigger: opp.vulnerability_trigger as string | null ?? null,
    opportunity_type: opp.opportunity_type as string | null ?? null,
    opportunity_score: opp.opportunity_score as number | null ?? null,
    commercial_why: opp.commercial_why as string | null ?? null,
    supplier_capabilities: (opp.supplier_capabilities as string[] | null) ?? null,
    sub_category: opp.sub_category as string | null ?? null,
  };
}

function normalizeInspector(opp: Opportunity): InspectorData {
  return {
    id: opp.id,
    canonical_id: opp.canonical_id,
    title: opp.title,
    sector: opp.sector,
    region: opp.region,
    country: opp.country ?? "",
    buyer: opp.buyer ?? "",
    predicted_value: opp.estimated_value ?? 0,
    currency: opp.currency ?? "GBP",
    confidence: opp.confidence ?? 50,
    signal_tier: opp.signal_tier ?? "STANDARD_COMMERCIAL",
    source_url: opp.source_url ?? "",
    source_name: opp.source_name ?? "",
    source_captured_at: opp.source_captured_at ?? "",
    summary: opp.summary ?? "",
    displacement_probability: (opp.opportunity_score ?? 50),
    primary_driver: opp.commercial_why ?? "",
    displacement_reasons: [],
    tech_stack: [],
    intent_signals: [],
  };
}