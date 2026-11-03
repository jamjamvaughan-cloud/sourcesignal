"use client";

import * as React from "react";
import Link from "next/link";
import { Target, ExternalLink } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Signal {
  id: string;
  title: string;
  sector: string;
  region: string;
  country: string;
  buyer: string;
  predicted_value: number;
  currency: string;
  confidence: number;
  signal_tier: string;
  displacement_probability: number;
  timeframe: string;
  primary_driver: string;
  recommended_action: string;
  status: "active" | "monitoring" | "validated";
  source_url: string;
  source_name: string;
}

const SIGNALS: Signal[] = [
  {
    id: "sig-001",
    title: "UK NHS Digital Infrastructure Refresh",
    sector: "Healthcare",
    region: "ENG",
    country: "UK",
    buyer: "NHS England",
    predicted_value: 85000000,
    currency: "GBP",
    confidence: 92,
    signal_tier: "MEGAPROCUREMENT",
    displacement_probability: 78,
    timeframe: "Q1 2027",
    primary_driver: "Legacy mainframe decommission + cloud sovereignty mandate",
    recommended_action: "Engage CIO and procurement lead before RFP publication",
    status: "validated",
    source_url: "https://www.gov.uk/government/publications/nhs-digital-infrastructure-refresh",
    source_name: "UK Government Digital Marketplace",
  },
  {
    id: "sig-002",
    title: "Deutsche Bundesbahn Rail Modernisation",
    sector: "Transport",
    region: "EU",
    country: "DE",
    buyer: "Deutsche Bahn AG",
    predicted_value: 120000000,
    currency: "EUR",
    confidence: 85,
    signal_tier: "MEGAPROCUREMENT",
    displacement_probability: 65,
    timeframe: "Q3 2027",
    primary_driver: "SAP ERP displacement with open-core alternative",
    recommended_action: "Position modular ERP pilot before budget cycle",
    status: "active",
    source_url: "https://www.deutschebahn.com/en/procurement",
    source_name: "Deutsche Bahn Procurement Portal",
  },
  {
    id: "sig-003",
    title: "French Ministry of Defence Cloud Programme",
    sector: "Defence",
    region: "EU",
    country: "FR",
    buyer: "Ministère des Armées",
    predicted_value: 210000000,
    currency: "EUR",
    confidence: 88,
    signal_tier: "MEGAPROCUREMENT",
    displacement_probability: 72,
    timeframe: "Q2 2027",
    primary_driver: "US hyperscaler replacement under cloud sovereignty law",
    recommended_action: "Engage security accreditation team early",
    status: "active",
    source_url: "https://www.defense.gouv.fr/achats",
    source_name: "French Defence Procurement",
  },
  {
    id: "sig-004",
    title: "Canadian Federal Procurement Portal",
    sector: "Government",
    region: "CA",
    country: "CA",
    buyer: "Public Services and Procurement Canada",
    predicted_value: 45000000,
    currency: "CAD",
    confidence: 79,
    signal_tier: "HIGH_CAP",
    displacement_probability: 58,
    timeframe: "Q4 2026",
    primary_driver: "Legacy Ariba instance end-of-life",
    recommended_action: "Submit capability statement ahead of RFI",
    status: "monitoring",
    source_url: "https://buyandsell.gc.ca/",
    source_name: "CanadaBuys Procurement Portal",
  },
  {
    id: "sig-005",
    title: "Australian State Health Records Migration",
    sector: "Healthcare",
    region: "AU",
    country: "AU",
    buyer: "NSW Health",
    predicted_value: 62000000,
    currency: "AUD",
    confidence: 81,
    signal_tier: "HIGH_CAP",
    displacement_probability: 69,
    timeframe: "Q1 2027",
    primary_driver: "Electronic health records platform consolidation",
    recommended_action: "Partner with local systems integrator",
    status: "active",
    source_url: "https://www.health.nsw.gov.au/procurement",
    source_name: "NSW Health Procurement",
  },
  {
    id: "sig-006",
    title: "Irish Public Sector Payroll Modernisation",
    sector: "Government",
    region: "IE",
    country: "IE",
    buyer: "Department of Public Expenditure",
    predicted_value: 28000000,
    currency: "EUR",
    confidence: 74,
    signal_tier: "HIGH_CAP",
    displacement_probability: 61,
    timeframe: "Q2 2027",
    primary_driver: "COBOL payroll system displacement",
    recommended_action: "Highlight COBOL migration de-risking case studies",
    status: "monitoring",
    source_url: "https://www.gov.ie/en/procurement/",
    source_name: "Irish Government Procurement",
  },
];

const COUNTRY_LABELS: Record<string, string> = {
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
};

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  monitoring: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  validated: "text-D4AF37 bg-D4AF37/10 border-D4AF37/20",
};

const TIER_STYLES: Record<string, string> = {
  MEGAPROCUREMENT: "text-D4AF37 border-D4AF37/20 bg-D4AF37/5",
  HIGH_CAP: "text-D4AF37 border-D4AF37/20 bg-D4AF37/5",
};

const DEAL_TIER_STYLES: Record<string, string> = {
  SMALL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  LARGE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  MEGA: "bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse",
};

const DEAL_TIER_LABELS: Record<string, string> = {
  SMALL: "Small (£50K–£500K)",
  MEDIUM: "Medium (£500K–£5M)",
  LARGE: "Large (£5M–£50M)",
  MEGA: "Mega (£50M–£500M+)",
};

function dealTier(value: number): string {
  if (value >= 50_000_000) return "MEGA";
  if (value >= 5_000_000) return "LARGE";
  if (value >= 500_000) return "MEDIUM";
  return "SMALL";
}

export default function PredictiveSignalsPage() {
  const [filter, setFilter] = React.useState<"all" | "active" | "monitoring" | "validated">("all");
  const [sort, setSort] = React.useState<"probability" | "confidence">("probability");
  const [userCountry, setUserCountry] = React.useState<string | null>(null);
  const [countryLoaded, setCountryLoaded] = React.useState(false);

  React.useEffect(() => {
    async function loadUserCountry() {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.country) {
            setUserCountry(data.user.country);
          }
        }
      } catch {
        // Silent fallback — show all signals
      } finally {
        setCountryLoaded(true);
      }
    }
    loadUserCountry();
  }, []);

  // Filter by user's country from signup, otherwise show all
  const countryFiltered = userCountry
    ? SIGNALS.filter((s) => s.country === userCountry)
    : SIGNALS;

  const filtered = countryFiltered.filter(
    (s) => filter === "all" || s.status === filter,
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "probability") return b.displacement_probability - a.displacement_probability;
    return b.confidence - a.confidence;
  });

  return (
    <div className="space-y-8 section-enter max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-inter font-bold text-white tracking-tight">Predictive Signals</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-400 uppercase mt-0.5">
            Displacement opportunities before RFP publication — filtered to your signup country{" "}
            {userCountry ? `(${COUNTRY_LABELS[userCountry as keyof typeof COUNTRY_LABELS] || userCountry})` : "not set"}
          </p>
        </div>
      </div>

      {!countryLoaded && (
        <div className="glass-card h-64 flex items-center justify-center">
          <p className="text-[10px] font-inter font-mono text-slate-400 animate-pulse">
            Loading your country-specific signals…
          </p>
        </div>
      )}

      {countryLoaded && (
        <>
          {/* Controls */}
          <div className="glass-panel p-4 flex flex-wrap items-center gap-4 max-w-full min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
                Status
              </span>
              <div className="flex gap-1">
                {[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "monitoring", label: "Monitoring" },
                  { value: "validated", label: "Validated" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() =>
                      setFilter(f.value as "all" | "active" | "monitoring" | "validated")
                    }
                    className={`px-3 py-1 rounded-md text-xs font-inter font-medium transition-colors ${
                      filter === f.value
                        ? "bg-white/10 text-white border border-white/10"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
                Sort by
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "probability" | "confidence")}
                className="text-xs font-inter text-slate-300 bg-transparent border-none focus:ring-0"
              >
                <option value="probability">Displacement Probability</option>
                <option value="confidence">Signal Confidence</option>
              </select>
            </div>
          </div>

          {/* Signals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
            {sorted.length === 0 ? (
              <div className="lg:col-span-3 glass-card p-12 text-center">
                <p className="text-[10px] font-inter font-mono text-slate-400">
                  No signals match your country ({userCountry ? COUNTRY_LABELS[userCountry as keyof typeof COUNTRY_LABELS] || userCountry : "not set"}).
                  Update your country in profile settings to see relevant displacement opportunities.
                </p>
              </div>
            ) : (
              sorted.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const statusStyle = STATUS_STYLES[signal.status];
  const tierStyle = TIER_STYLES[signal.signal_tier ?? ""];
  const probColor =
    signal.displacement_probability >= 70
      ? "text-D4AF37"
      : signal.displacement_probability >= 50
        ? "text-amber-400"
        : "text-slate-400";

  const dealTierKey = dealTier(signal.predicted_value);
  const dealTierStyle = DEAL_TIER_STYLES[dealTierKey];
  const dealTierLabel = DEAL_TIER_LABELS[dealTierKey];

  return (
    <Link
      href={`/dashboard/signals/${signal.id}`}
      className="glass-card rounded-2xl border border-slate-800 overflow-hidden group hover:border-D4AF37/30 transition-all duration-300 ease-in-out"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Target className="h-3 w-3 text-D4AF37" />
            <span className={`text-[9px] font-inter font-bold ${probColor} uppercase tracking-tighter`}>
              {signal.displacement_probability}% displacement
            </span>
          </div>
          <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${statusStyle}`}>
            {signal.status.toUpperCase()}
          </span>
          <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${dealTierStyle}`}>
            {dealTierLabel}
          </span>
        </div>

        <h3 className="text-sm font-inter font-bold text-white mb-1.5 group-hover:text-D4AF37/80 transition-colors">
          {signal.title}
        </h3>
        <p className="text-[9px] font-inter font-mono text-slate-400 mb-4">
          {signal.buyer} · {COUNTRY_LABELS[signal.country] || signal.country} · {signal.sector}
        </p>

        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-inter font-semibold text-slate-500 uppercase tracking-wider">
              Predicted Value
            </span>
            <span className="text-sm font-inter font-bold text-white font-mono tabular-nums">
              {signal.currency === "GBP" ? "£" : signal.currency === "EUR" ? "€" : "$"}{signal.predicted_value.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-inter font-semibold text-slate-500 uppercase tracking-wider">
              Timeframe
            </span>
            <span className="text-sm font-inter text-slate-300 font-mono tabular-nums">
              {signal.timeframe}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-inter font-semibold text-slate-500 uppercase tracking-wider">
              Signal Tier
            </span>
            <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${tierStyle}`}>
              {signal.signal_tier.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Primary Driver
          </p>
          <p className="text-sm font-inter text-slate-300 leading-relaxed">
            {signal.primary_driver}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <a
          href={signal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full text-[9px] font-inter font-bold uppercase tracking-tighter ${dealTierStyle} hover:opacity-90 transition-colors px-3 py-2 rounded-md`}
        >
          ↗️ Open Original Signal Source <ExternalLink className="ml-1 h-3 w-3" />
        </a>
      </div>
    </Link>
  );
}
