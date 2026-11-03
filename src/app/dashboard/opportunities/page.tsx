"use client";

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
import { ChevronRight } from "lucide-react";
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
}

const DEMO_INSPECTORS: Record<string, InspectorData> = {
  "ss-aws-2026-001": {
    id: "demo-aws",
    canonical_id: "SS-AWS-2026-001",
    title: "AWS Cloud Migration Displacement",
    sector: "Technology",
    region: "US",
    country: "US",
    buyer: "Amazon Web Services",
    predicted_value: 4200000,
    currency: "USD",
    confidence: 94,
    signal_tier: "MEGAPROCUREMENT",
    source_url: "https://example.com/aws-rfp",
    source_name: "AWS Public Sector RFP Portal",
    source_captured_at: "2026-10-15T09:30:00Z",
    summary:
      "Large enterprise seeking to displace AWS with a multi-cloud strategy due to egress fee surges and vendor lock-in concerns.",
    displacement_probability: 78,
    primary_driver: "300% egress fee increase over 18 months",
    displacement_reasons: [
      "300% egress fee increase over 18 months",
      "Vendor lock-in with no exit strategy",
      "Annual audit pressure and compliance overhead",
    ],
    tech_stack: [
      { name: "AWS S3", category: "Storage", maturity: "legacy" },
      { name: "AWS EC2", category: "Compute", maturity: "legacy" },
      { name: "Kubernetes", category: "Orchestration", maturity: "modern" },
      { name: "Terraform", category: "IaC", maturity: "modern" },
    ],
    intent_signals: [
      { name: "Egress Fee Surge", value: "+300%", severity: "high" },
      { name: "Vendor Lock-in Risk", value: "Critical", severity: "high" },
      { name: "Renewal Window", value: "180 days", severity: "medium" },
    ],
  },
  "ss-sf-2026-014": {
    id: "demo-salesforce",
    canonical_id: "SS-SF-2026-014",
    title: "Salesforce CRM Replacement",
    sector: "Technology",
    region: "ENG",
    country: "UK",
    buyer: "Salesforce",
    predicted_value: 1850000,
    currency: "GBP",
    confidence: 87,
    signal_tier: "HIGH_CAP",
    source_url: "https://example.com/salesforce-rfp",
    source_name: "UK Government Digital Marketplace",
    source_captured_at: "2026-10-14T14:20:00Z",
    summary:
      "Mid-market retail group evaluating modular CRM alternatives due to per-seat pricing fatigue and underutilized features.",
    displacement_probability: 65,
    primary_driver: "Per-seat pricing fatigue at 200+ users",
    displacement_reasons: [
      "Per-seat pricing fatigue at 200+ users",
      "40% of licenses underutilized",
      "Complex renewal negotiations",
    ],
    tech_stack: [
      { name: "Salesforce Sales Cloud", category: "CRM", maturity: "legacy" },
      { name: "Marketing Cloud", category: "Marketing", maturity: "legacy" },
      { name: "Slack", category: "Collaboration", maturity: "modern" },
    ],
    intent_signals: [
      { name: "License Underutilization", value: "40%", severity: "medium" },
      { name: "Pricing Fatigue", value: "High", severity: "high" },
      { name: "Renewal Window", value: "90 days", severity: "medium" },
    ],
  },
  "ss-ora-2026-033": {
    id: "demo-oracle",
    canonical_id: "SS-ORA-2026-033",
    title: "Oracle Database Migration",
    sector: "Finance",
    region: "EU",
    country: "DE",
    buyer: "Oracle Corporation",
    predicted_value: 5600000,
    currency: "EUR",
    confidence: 91,
    signal_tier: "MEGAPROCUREMENT",
    source_url: "https://example.com/oracle-rfp",
    source_name: "German Federal Procurement Portal",
    source_captured_at: "2026-10-13T11:00:00Z",
    summary:
      "Financial services group planning Oracle database displacement due to annual audit pressure and rising licensing costs.",
    displacement_probability: 72,
    primary_driver: "Annual audit pressure and rising licensing costs",
    displacement_reasons: [
      "Annual audit pressure and compliance costs",
      "Rising annual licensing fees",
      "Legacy skill shortage in-house",
    ],
    tech_stack: [
      { name: "Oracle Database 19c", category: "Database", maturity: "legacy" },
      { name: "Oracle Exadata", category: "Hardware", maturity: "legacy" },
      { name: "PostgreSQL", category: "Database", maturity: "modern" },
    ],
    intent_signals: [
      { name: "Audit Pressure", value: "High", severity: "high" },
      { name: "Licensing Cost Increase", value: "+45%", severity: "high" },
      { name: "Renewal Window", value: "210 days", severity: "low" },
    ],
  },
};

const SECTOR_STYLES: Record<string, string> = {
  Infrastructure: "bg-white/5 text-slate-300 border border-white/10",
  Energy: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Defence: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Technology: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Construction: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Logistics: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Manufacturing: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Healthcare: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  Finance: "bg-white/5 text-D4AF37 border border-D4AF37/20",
  default: "bg-white/5 text-slate-300 border border-white/10",
};

const NOW = new Date("2026-11-01").getTime();

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<InspectorData | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    async function fetchOpportunities() {
      try {
        const res = await fetch(`${API_URL}/api/opportunities?perPage=50`, {
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
  }, []);

  const handleOpenInspector = (id: string) => {
    const inspector = DEMO_INSPECTORS[id] ?? null;
    setSelected(inspector);
    setDrawerOpen(true);
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

  if (opportunities.length === 0) {
    return (
      <EmptyState
        title="No opportunities found"
        description="No active tenders match your current filters."
      />
    );
  }

  return (
    <>
      <div className="space-y-6 section-enter max-w-full min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
          <div>
            <h1 className="headline mb-0.5">Corporate Explorer</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
              High-density commercial tender intelligence.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              className="text-[10px] font-inter font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 ease-out px-4 py-2 rounded-xl"
              onClick={() => setOpportunities([])}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1 h-4 w-4"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Reset
            </Button>
          </div>
        </div>

        <div className="glass-panel p-3 flex flex-wrap items-center gap-3 max-w-full min-w-0">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-slate-500"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <Input
              placeholder="Search title, buyer, summary…"
              className="h-10 text-xs px-3 min-w-[200px] w-auto bg-transparent border-transparent text-white placeholder-slate-500 focus:border-D4AF37 focus:ring-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="all" onValueChange={() => {}}>
              <SelectTrigger className="h-10 text-xs px-3 min-w-[140px] w-auto bg-transparent border-transparent text-white focus:border-D4AF37 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="p-2 bg-[#09090b] border border-white/10">
                <SelectItem value="all">All Sectors</SelectItem>
                {[
                  { id: "technology", name: "Technology" },
                  { id: "finance", name: "Finance" },
                  { id: "healthcare", name: "Healthcare" },
                  { id: "manufacturing", name: "Manufacturing" },
                  { id: "logistics", name: "Logistics" },
                  { id: "construction", name: "Construction" },
                  { id: "energy", name: "Energy" },
                  { id: "defence", name: "Defence" },
                  { id: "infrastructure", name: "Infrastructure" },
                ].map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="all" onValueChange={() => {}}>
              <SelectTrigger className="h-10 text-xs px-3 min-w-[120px] w-auto bg-transparent border-transparent text-white focus:border-D4AF37 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="p-2 bg-[#09090b] border border-white/10">
                <SelectItem value="all">All Regions</SelectItem>
                {["US", "CA", "ENG", "SCT", "WLS", "NIR", "IE", "AU", "EU"].map(
                  (r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="all" onValueChange={() => {}}>
              <SelectTrigger className="h-10 text-xs px-3 min-w-[120px] w-auto bg-transparent border-transparent text-white focus:border-D4AF37 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="p-2 bg-[#09090b] border border-white/10">
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="awarded">Awarded</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
                {opportunities.map((opp) => {
                  const inspectorId = opp.canonical_id?.toLowerCase().replace(/[^a-z0-9]/g, "-") || opp.id;
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
                      onClick={() => handleOpenInspector(inspectorId)}
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
                              ? new Date(opp.created_at).toLocaleDateString(
                                  "en-GB",
                                )
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
  };
}
