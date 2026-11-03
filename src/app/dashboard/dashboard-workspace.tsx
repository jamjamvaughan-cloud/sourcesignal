"use client";

import * as React from "react";
import {
  ArrowUpRight,
  List,
  MapPin,
  Radar,
  Search,
  X,
} from "lucide-react";
import { TerritoryRadar, type RadarPoint } from "@/components/territory-radar";
import { SignalDrawer } from "@/components/signal-drawer";
import { useSignalStream } from "@/hooks/use-signal-stream";
import {
  capabilityBadges,
  commercialWhy,
  daysUntil,
  estimatedSpend,
  formatSpend,
  opportunityTypeLabel,
  regionLabel,
  sectorLabel,
  signalScore,
  type SignalRecord,
} from "@/lib/signal-view";

export type DashboardOpportunity = SignalRecord;

interface DashboardWorkspaceProps {
  opportunities: DashboardOpportunity[];
  /** Quiet provenance line rendered directly below the search bar. */
  primarySourcesLabel: string;
}

const SECTOR_CHIPS = [
  { id: "all", label: "All" },
  { id: "technology-infrastructure", label: "Tech" },
  { id: "energy", label: "Energy" },
  { id: "healthcare-infrastructure", label: "Healthcare" },
  { id: "public-sector-services", label: "Public Sector" },
  { id: "construction", label: "Construction" },
  { id: "transport", label: "Transport" },
  { id: "logistics-and-distribution", label: "Logistics" },
] as const;

const TYPE_CHIPS = [
  { id: "all", label: "All types" },
  { id: "PROJECT", label: "Project" },
  { id: "PROCUREMENT", label: "Procurement" },
  { id: "EXPANSION", label: "Expansion" },
  { id: "TRANSFORMATION", label: "Transformation" },
  { id: "COMPLIANCE", label: "Compliance" },
  { id: "MODERNISATION", label: "Modernisation" },
  { id: "FUNDING", label: "Funding" },
  { id: "CONTRACT_FRAMEWORK", label: "Framework" },
  { id: "POLICY_PROGRAMME", label: "Policy" },
] as const;

type ViewMode = "list" | "radar";
type MobilePanel = "cards" | "map";

function closingLabel(closingDate?: string | null): string {
  const days = daysUntil(closingDate);
  if (days == null) return "—";
  if (days < 0) return "CLOSED";
  if (days === 0) return "TODAY";
  return `${days}D`;
}

const SOURCE_BADGE_LABELS: Record<string, string> = {
  "GOV.UK Find a Tender": "GOV.UK",
  "Planning Permits": "PLANNING",
  "Companies House": "COMPANIES HOUSE",
  USAspending: "USAspending",
  "SAM.gov": "SAM.gov",
  "SEC EDGAR": "SEC EDGAR",
  "TED EU": "TED EU",
  "EU Open Data": "EU OPEN DATA",
};

function jurisdictionBadge(region?: string | null): string {
  return `[${((region ?? "").trim().toUpperCase() || "—")}]`;
}

function sourceBadge(sourceName?: string | null): string {
  const name = (sourceName ?? "").trim();
  const mapped = (SOURCE_BADGE_LABELS[name] ?? name.toUpperCase()) || "SOURCE";
  return `[${mapped}]`;
}

function SignalCard({
  opportunity,
  onOpen,
  active,
}: {
  opportunity: DashboardOpportunity;
  onOpen: () => void;
  active?: boolean;
}) {
  const score = signalScore(opportunity);
  const spend = formatSpend(
    estimatedSpend(opportunity),
    opportunity.currency,
  );
  const badges = capabilityBadges(opportunity);
  const buyer = opportunity.buyer?.trim() || opportunity.title;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group cursor-pointer border bg-[#050505] p-4 transition-colors duration-150 ${
        active
          ? "border-[#D4AF37]"
          : "border-white/10 hover:border-white/35 hover:bg-[#080808]"
      }`}
    >
      {/* Meta line */}
      <div className="flex items-center justify-between gap-3 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="border border-white/10 px-1.5 py-0.5 bg-white/5 text-[#D4AF37]">
            {jurisdictionBadge(opportunity.region)}
          </span>
          <span className="border border-white/10 px-1.5 py-0.5 bg-white/5 text-zinc-400">
            {sourceBadge(opportunity.source_name)}
          </span>
          <span className="truncate text-zinc-500">
            {sectorLabel(opportunity.sector)}
          </span>
        </div>
        <span className="flex-shrink-0 text-zinc-600">
          {opportunityTypeLabel(opportunity.opportunity_type)}
        </span>
      </div>

      {/* Buyer + score */}
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-base font-bold uppercase tracking-tight text-white">
            {buyer}
          </h3>
          {opportunity.buyer && (
            <p className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed text-zinc-500">
              {opportunity.title}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 border-l border-white/10 pl-4 text-right">
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600">
            Score
          </p>
          <p className="font-mono text-2xl font-bold leading-none tabular-nums text-white">
            {score}
          </p>
        </div>
      </div>

      {/* Core metrics */}
      <div className="mt-4 grid grid-cols-2 gap-px bg-white/10">
        <div className="bg-[#050505] py-2 pr-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600">
            Est. spend
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
            {spend}
          </p>
        </div>
        <div className="bg-[#050505] py-2 pl-3 text-right">
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600">
            Closes
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
            {closingLabel(opportunity.closing_date)}
          </p>
        </div>
      </div>

      {/* Commercial why */}
      <div className="mt-3 border-l border-[#D4AF37] pl-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-zinc-600">
          Commercial why
        </p>
        <p className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed text-zinc-400">
          {commercialWhy(opportunity)}
        </p>
      </div>

      {/* Capability badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {badges.map((badge) => (
          <span
            key={badge}
            className="border border-white/10 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-zinc-500"
          >
            {badge}
          </span>
        ))}
        <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-zinc-700 transition-colors group-hover:text-[#D4AF37]" />
      </div>
    </article>
  );
}

export function DashboardWorkspace({
  opportunities,
  primarySourcesLabel,
}: DashboardWorkspaceProps) {
  const [query, setQuery] = React.useState("");
  const [sector, setSector] = React.useState<string>("all");
  const [opportunityType, setOpportunityType] = React.useState<string>("all");
  const [view, setView] = React.useState<ViewMode>("list");
  const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>("cards");
  const [selected, setSelected] = React.useState<DashboardOpportunity | null>(
    null,
  );

  const [liveSignals, setLiveSignals] = React.useState<DashboardOpportunity[]>(
    [],
  );

  // Real-time signal stream (SSE).
  const { isConnected, clientCount, error, reconnect } =
    useSignalStream(
      (event) => {
        const signalId = event.id;
        if (!signalId) return;
        setLiveSignals((prev) => {
          // Avoid duplicates by source_hash or id.
          if (prev.some((s) => s.id === signalId)) return prev;
          const record: DashboardOpportunity = {
            id: signalId,
            canonical_id: signalId,
            title: event.title ?? "Untitled signal",
            buyer: event.buyer_name ?? null,
            sector: event.sector ?? "TECH",
            region: event.jurisdiction ?? "UK",
            country: event.jurisdiction ?? null,
            location: null,
            estimated_value: event.estimated_value ?? null,
            currency: null,
            procurement_stage: null,
            published_date: event.published_at ?? null,
            closing_date: null,
            confidence: null,
            signal_tier: null,
            source_url: event.source_url ?? null,
            source_name: event.source_name ?? null,
            source_captured_at: event.created_at ?? null,
            source_hash: event.source_hash ?? null,
            summary: null,
            is_demonstration: false,
            created_at: event.created_at ?? null,
            updated_at: null,
            vulnerability_trigger: null,
            winner: null,
            opportunity_score: null,
            opportunity_type: event.opportunity_type ?? null,
            commercial_why: event.commercial_why ?? null,
            supplier_capabilities: null,
            sub_category: null,
          };
          return [record, ...prev];
        });
      },
      true,
    );

  const allSignals = React.useMemo(
    () => [...liveSignals, ...opportunities],
    [liveSignals, opportunities],
  );

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return allSignals
      .filter((opportunity) => {
        if (sector !== "all" && opportunity.sector !== sector) return false;
        if (
          opportunityType !== "all" &&
          (opportunity.opportunity_type ?? "").toUpperCase() !== opportunityType
        ) {
          return false;
        }
        if (!term) return true;
        return [
          opportunity.title,
          opportunity.buyer,
          opportunity.location,
          opportunity.summary,
          opportunity.commercial_why,
          opportunity.sub_category,
          opportunity.opportunity_type,
          opportunity.sector,
          opportunity.region,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const scoreDelta = signalScore(b) - signalScore(a);
        if (scoreDelta !== 0) return scoreDelta;
        const aClosing = daysUntil(a.closing_date) ?? Number.MAX_SAFE_INTEGER;
        const bClosing = daysUntil(b.closing_date) ?? Number.MAX_SAFE_INTEGER;
        return aClosing - bClosing;
      });
  }, [allSignals, query, sector, opportunityType]);

  const radarPoints: RadarPoint[] = React.useMemo(
    () =>
      allSignals.map((opportunity) => ({
        id: opportunity.id,
        region: opportunity.region,
        sector: opportunity.sector,
        label: `${opportunity.buyer?.trim() || opportunity.title} — ${
          regionLabel(opportunity.region)
        }`,
        score: signalScore(opportunity),
      })),
    [allSignals],
  );

  const openById = React.useCallback(
    (id: string) => {
      const opportunity = filtered.find(
        (item) => item.id === id || item.canonical_id === id,
      );
      if (opportunity) setSelected(opportunity);
    },
    [filtered],
  );

  const resetFilters = () => {
    setQuery("");
    setSector("all");
    setOpportunityType("all");
  };

  return (
    <div className="min-w-0 space-y-10">
      {/* Header + view switcher */}
      <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.35em] text-zinc-500">
            SourceSignal // Opportunity Engine
          </p>
          <h1 className="mt-2 font-mono text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
            Commercial Signal Feed
          </h1>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">
            Real-time opportunity signals the second they drop
          </p>
        </div>

        <div className="flex w-full border border-white/10 lg:w-auto">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors lg:flex-none ${
              view === "list"
                ? "bg-white text-black"
                : "bg-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List View
          </button>
          <button
            type="button"
            onClick={() => setView("radar")}
            aria-pressed={view === "radar"}
            className={`flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap border-l border-white/10 px-4 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors lg:flex-none ${
              view === "radar"
                ? "bg-white text-black"
                : "bg-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <Radar className="h-3.5 w-3.5" />
            Radar Map
          </button>
        </div>

        {/* Live SSE connection indicator */}
        <div className="flex items-center gap-2 ml-4 border-l border-white/10 pl-4">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              isConnected
                ? "bg-emerald-500"
                : error
                  ? "bg-red-500"
                  : "bg-slate-500"
            }`}
          />
          <span className="font-mono text-[8px] uppercase tracking-[0.18em]">
            {isConnected
              ? `LIVE · ${clientCount ?? 0} client${clientCount === 1 ? "" : "s"}`
              : error ?? "RECONNECTING…"}
          </span>
          {!isConnected && error && !error.includes("subscription") && !error.includes("authenticated") && (
            <button
              type="button"
              onClick={reconnect}
              className="ml-1 border border-white/10 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-zinc-400 hover:border-white/30 hover:text-white"
            >
              Retry
            </button>
          )}
        </div>
      </header>

      {/* Hero search */}
      <section className="border border-white/10 bg-[#050505]">
        <div className="flex items-center gap-3 px-4 py-4">
          <Search className="h-4 w-4 flex-shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 15+ verified primary sources..."
            aria-label="Search verified primary sources"
            className="w-full bg-transparent font-mono text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-white/10 text-zinc-500 transition-colors hover:border-white/30 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-white/10 px-4 py-3">
          {SECTOR_CHIPS.map((chip) => {
            const active = sector === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSector(chip.id)}
                aria-pressed={active}
                className={`flex-shrink-0 whitespace-nowrap border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "border-white bg-white text-black"
                    : "border-white/10 text-zinc-500 hover:border-white/35 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-white/10 px-4 py-2.5">
          <span className="flex-shrink-0 font-mono text-[8px] uppercase tracking-[0.24em] text-zinc-600">
            Type
          </span>
          {TYPE_CHIPS.map((chip) => {
            const active = opportunityType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setOpportunityType(chip.id)}
                aria-pressed={active}
                className={`flex-shrink-0 border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "border-[#D4AF37] text-[#D4AF37]"
                    : "border-transparent text-zinc-600 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <span className="ml-auto flex-shrink-0 pl-3 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-600">
            {filtered.length} signal{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <p className="border-b border-zinc-900 py-2 font-mono text-[11px] uppercase text-zinc-500">
        {primarySourcesLabel}
      </p>

      {filtered.length === 0 ? (
        <section className="border border-white/10 bg-[#050505] px-6 py-16 text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-zinc-500">
            No signals match this filter
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 border border-white/20 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white transition-colors hover:border-white/50 hover:bg-white/5"
          >
            Reset filters
          </button>
        </section>
      ) : view === "list" ? (
        <div className="space-y-4">
          {/* Mobile/tablet panel toggle — keeps both panels usable below lg */}
          <div className="flex border border-white/10 lg:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel("cards")}
              aria-pressed={mobilePanel === "cards"}
              className={`flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.18em] transition-colors ${
                mobilePanel === "cards"
                  ? "bg-white text-black"
                  : "bg-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Show Cards
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel("map")}
              aria-pressed={mobilePanel === "map"}
              className={`flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap border-l border-white/10 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors ${
                mobilePanel === "map"
                  ? "bg-white text-black"
                  : "bg-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Radar className="h-3.5 w-3.5" />
              Show Map
            </button>
          </div>

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* 60% signal stream */}
            <section
              aria-label="Priority signal feed"
              className={`${mobilePanel === "cards" ? "block" : "hidden"} lg:block`}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
                  Priority stream
                </p>
                <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-emerald-400">
                  <span className="h-1.5 w-1.5 bg-emerald-400" />
                  Live
                </span>
              </div>
              <div className="space-y-3">
                {filtered.map((opportunity) => (
                  <SignalCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    active={selected?.id === opportunity.id}
                    onOpen={() => setSelected(opportunity)}
                  />
                ))}
              </div>
            </section>

            {/* 40% sticky territory radar */}
            <aside
              className={`${
                mobilePanel === "map" ? "block" : "hidden"
              } lg:sticky lg:top-20 lg:block`}
            >
              <TerritoryRadar
                points={radarPoints}
                selectedId={selected?.id}
                onSelect={openById}
              />
              <div className="mt-3 flex items-start gap-2 border border-white/10 px-3 py-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                <p className="font-mono text-[8px] uppercase leading-relaxed tracking-[0.14em] text-zinc-600">
                  Plot reflects captured primary-source evidence. Select any
                  marker to open its provenance record.
                </p>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Full-width territory radar */}
          <TerritoryRadar
            points={radarPoints}
            selectedId={selected?.id}
            onSelect={openById}
          />

          <section aria-label="Priority queue">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
                Priority queue
              </p>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-600">
                {filtered.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, 9).map((opportunity) => (
                <SignalCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  active={selected?.id === opportunity.id}
                  onOpen={() => setSelected(opportunity)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      <SignalDrawer
        opportunity={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
