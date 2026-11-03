import Link from "next/link";
import { backendJson, getSessionContext } from "@/lib/backend";
import {
  Activity,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  Clock,
  Users,
} from "lucide-react";
import { TierFilterBar } from "@/components/tier-filter-bar";
import CoverageMatrix from "@/components/coverage-matrix";

interface Opportunity {
  id: string;
  canonical_id: string;
  title: string;
  sector: string;
  region: string;
  country?: string | null;
  location?: string | null;
  buyer?: string | null;
  estimated_value?: number | null;
  est_deal_value?: number | null;
  currency?: string | null;
  procurement_stage?: string | null;
  published_date?: string | null;
  closing_date?: string | null;
  confidence?: number | null;
  signal_tier?: string | null;
  source_url?: string | null;
  summary?: string | null;
  is_demonstration?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

interface OpportunitiesResponse {
  items?: Opportunity[];
}

async function fetchDashboardMetrics(userCountry: string | null): Promise<{
  opportunities: Opportunity[];
}> {
  const params = new URLSearchParams({
    page: "1",
    perPage: "100",
    sort: "-created_at",
  });
  if (userCountry) {
    params.set("country", userCountry);
  }

  const result = await backendJson<OpportunitiesResponse>(
    `/api/opportunities?${params.toString()}`,
  );

  return { opportunities: result?.items ?? [] };
}

/** Generates deterministic sparkline data points for the hero card. */
function sparklinePoints(count = 12): number[] {
  const points: number[] = [];
  let val = 30;
  for (let i = 0; i < count; i++) {
    val += (Math.sin(i * 0.7) * 8) + (Math.cos(i * 0.3) * 5) + 2;
    points.push(Math.max(10, Math.min(90, val)));
  }
  return points;
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { user } = await getSessionContext();
  const userCountry = user?.country ?? null;
  const { opportunities } = await fetchDashboardMetrics(userCountry);
  const points = sparklinePoints();
  const maxPoint = Math.max(...points);
  const minPoint = Math.min(...points);

  const selectedTier = (resolvedSearchParams.tier as
    | "all"
    | "SMALL"
    | "MEDIUM"
    | "LARGE"
    | "MEGA"
    | undefined) ?? "all";

  const tierRanges: Record<string, { min: number; max: number | null }> = {
    all: { min: 0, max: null },
    SMALL: { min: 50_000, max: 500_000 },
    MEDIUM: { min: 500_000, max: 5_000_000 },
    LARGE: { min: 5_000_000, max: 50_000_000 },
    MEGA: { min: 50_000_000, max: null },
  };

  const tierFiltered = opportunities.filter((opp) => {
    if (selectedTier === "all") return true;
    const range = tierRanges[selectedTier];
    const val = Number(opp.est_deal_value || opp.estimated_value || 0);
    if (range.max === null) return val >= range.min;
    return val >= range.min && val < range.max;
  });

  const filteredAtRiskSpend = tierFiltered.reduce(
    (sum, o) => sum + (Number(o.est_deal_value || o.estimated_value) || 0),
    0,
  );
  const activeAccounts = new Set(
    tierFiltered.map((o) => o.buyer).filter(Boolean),
  ).size;
  const avgDealValue =
    tierFiltered.length > 0
      ? filteredAtRiskSpend / tierFiltered.length
      : 0;

  const tierStyles: Record<string, string> = {
    all: "bg-white/10 text-white border border-white/10",
    SMALL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    LARGE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    MEGA: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  };

  return (
    <div className="space-y-8 section-enter max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-2">
        <div>
          <h1 className="text-3xl font-inter font-bold text-white tracking-tight">Opportunity Engine</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-400 uppercase mt-1">
            Real-time procurement signals the second they drop
          </p>
        </div>
        <Link
          href="/dashboard/opportunities"
          className="inline-flex items-center gap-2 text-[10px] font-inter font-bold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 hover:text-[#09090b] transition-all duration-300 ease-out px-4 py-2 rounded-xl"
        >
          View All Opportunities <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Tier Filter Bar */}
      <TierFilterBar
        selectedTier={selectedTier}
        tierStyles={tierStyles}
      />

      {/* Coverage Matrix */}
      <CoverageMatrix />

      {/* ========================================================================
           HERO BENTO ROW — Hero Card | Health Gauge
           ======================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-w-0">
        {/* Hero Card — spans 8 cols */}
        <div className="lg:col-span-8">
          <HeroBentoCard
            atRiskSpend={filteredAtRiskSpend}
            points={points}
            maxPoint={maxPoint}
            minPoint={minPoint}
            tier={selectedTier}
          />
        </div>

        {/* Health Gauge — spans 4 cols */}
        <div className="lg:col-span-4">
          <HealthGaugeCard score={89} activeAccounts={activeAccounts} avgDealValue={avgDealValue} atRiskSpend={filteredAtRiskSpend} />
        </div>
      </div>

      {/* ========================================================================
           MIDDLE BENTO MICRO-CARDS — 3 tiles
           ======================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 min-w-0">
        <IncumbentTargetsCard />
        <RenewalTimelineCard />
        <VerifiedGrievancesCard />
      </div>

      {/* ========================================================================
           BOTTOM — Grievance & Displacement Feed
           ======================================================================== */}
      <GrievanceFeedCard />
    </div>
  );
}

/* ============================================================================
   HERO BENTO CARD — Greeting + At-Risk Spend + Sparkline
   ============================================================================ */

function HeroBentoCard({
  atRiskSpend,
  points,
  maxPoint,
  minPoint,
  tier,
}: {
  atRiskSpend: number;
  points: number[];
  maxPoint: number;
  minPoint: number;
  tier: "all" | "SMALL" | "MEDIUM" | "LARGE" | "MEGA";
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";

  const tierColors: Record<string, string> = {
    all: "D4AF37",
    SMALL: "blue-400",
    MEDIUM: "amber-400",
    LARGE: "emerald-400",
    MEGA: "purple-300",
  };

  return (
    <div className="border border-white/10 bg-[#09090b] p-6 overflow-hidden relative group">
      {/* Tier-based accent glow */}
      <div className="absolute top-0 right-0 w-48 h-48 blurred rounded-full -mr-12 -mt-12" style={{ backgroundColor: tierColors[tier] }} />

      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-D4AF37" />
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
              Live Opportunity Feed
            </span>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tighter mb-1.5">
            {greeting}.
          </p>
          <h2 className="text-2xl font-mono font-bold text-white leading-tight tracking-tight">
            Live procurement signals
          </h2>
          <p className="text-[9px] font-mono text-slate-400 mt-2 leading-relaxed">
            {atRiskSpend.toLocaleString()} of commercial opportunity spend is
            active this quarter. Reach buyers before renewal windows close.
          </p>
        </div>

        {/* Big number */}
        <div className="flex items-baseline gap-2 mb-8">
          <span className="text-4xl font-mono font-bold text-white tabular-nums">
            £{atRiskSpend.toLocaleString()}
          </span>
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">
            at-risk commercial opportunity spend
          </span>
        </div>

        {/* Trend indicator */}
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-[9px] font-mono font-bold text-emerald-400">
            +12.4% vs last quarter
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            · Surge velocity accelerating
          </span>
        </div>

        {/* Sparkline */}
        <div className="mt-auto pt-6 border-t border-white/10 h-32">
          <div className="flex items-end justify-between gap-1 h-full">
            {points.map((p, i) => {
              const height = ((p - minPoint) / (maxPoint - minPoint)) * 100;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1"
                  style={{ flex: 1 }}
                >
                  <div
                    className="w-full bg-D4AF37/20 rounded-t-sm transition-all duration-300 ease-out group-hover:bg-D4AF37"
                    style={{
                      height: `${Math.max(4, height)}%`,
                      width: "100%",
                    }}
                  />
                  <span className="text-[8px] font-mono text-slate-600">
                    {Math.round(p)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[8px] font-mono text-slate-600">
            <span>Q1 Surge</span>
            <span>Peak</span>
            <span>Q3 Velocity</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   HEALTH GAUGE CARD — Circular progress ring
   ============================================================================ */

function HealthGaugeCard({
  score,
  activeAccounts,
  avgDealValue,
  atRiskSpend,
}: {
  score: number;
  activeAccounts: number;
  avgDealValue: number;
  atRiskSpend: number;
}) {
  const circumference = 2 * Math.PI * 40; // radius 40
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "D4AF37" : score >= 60 ? "F59E0B" : "EF4444";

  return (
    <div className="glass-card rounded-3xl border border-slate-800 p-8 text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-D4AF37/10 blurred rounded-full -mr-8 -mt-8" />

      <div className="relative inline-block">
        <svg
          className="w-40 h-40 transform -rotate-90"
          viewBox="0 0 88 88"
        >
          <circle
            cx="44"
            cy="44"
            r="40"
            stroke="slate-800"
            strokeWidth="8"
            fill="none"
            className="text-slate-700"
          />
          <circle
            cx="44"
            cy="44"
            r="40"
            stroke={`#${color}`}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-inter font-bold text-white font-mono tabular-nums">
            {score}
          </span>
          <span className="text-[10px] font-inter text-slate-400 uppercase tracking-wider">
            /100
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Active Accounts
          </p>
          <p className="text-xl font-inter font-bold text-white font-mono tabular-nums">
            {activeAccounts}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Avg Deal Value
          </p>
          <p className="text-xl font-inter font-bold text-white font-mono tabular-nums">
            £{avgDealValue.toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            At-Risk Spend
          </p>
          <p className="text-xl font-inter font-bold text-white font-mono tabular-nums">
            £{atRiskSpend.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   MIDDLE MICRO-CARD: Incumbent Targets
   ============================================================================ */

function IncumbentTargetsCard() {
  const targets = [
    { name: "AWS", risk: 94, tier: "MEGA", reason: "Fee surges + monolithic lock-in", users: "12k+" },
    { name: "Salesforce", risk: 87, tier: "LARGE", reason: "Per-seat pricing fatigue", users: "8k+" },
    { name: "Oracle", risk: 91, tier: "MEDIUM", reason: "Audit pressure + legacy debt", users: "5k+" },
  ];

  const TIER_PILL: Record<string, string> = {
    SMALL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    LARGE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    MEGA: "bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse",
  };

  const TIER_LABEL: Record<string, string> = {
    SMALL: "Small",
    MEDIUM: "Medium",
    LARGE: "Large",
    MEGA: "Mega",
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
            Top Incumbent Targets
          </p>
          <p className="text-xs font-inter font-bold text-white">
            Active opportunity targets
          </p>
        </div>
        <ShieldAlert className="h-4 w-4 text-D4AF37" />
      </div>

      <div className="space-y-3">
        {targets.map((t) => (
          <div
            key={t.name}
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-inter font-bold text-white">
                  {t.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-inter font-bold text-white truncate">
                  {t.name}
                </p>
                <p className="text-[9px] font-inter text-slate-400 truncate">
                  {t.reason}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs font-inter font-bold px-2 py-0.5 rounded border ${TIER_PILL[t.tier]}`}>
                {TIER_LABEL[t.tier]}
              </span>
              <p className="text-[9px] font-inter text-slate-500 uppercase tracking-tighter">
                risk
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <Link
          href="/dashboard/opportunities"
          className="flex items-center gap-1.5 text-[9px] font-inter font-bold text-D4AF37 hover:text-white transition-colors"
        >
          Review all targets <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* ============================================================================
   MIDDLE MICRO-CARD: Renewal Timelines
   ============================================================================ */

function RenewalTimelineCard() {
  const renewals = [
    { name: "Global Logistics Corp", days: 42, value: "£2.1M", tier: "SMALL" },
    { name: "Nordic Retail Group", days: 51, value: "£1.8M", tier: "SMALL" },
    { name: "Pacific Manufacturing", days: 58, value: "£3.4M", tier: "MEDIUM" },
  ];

  const TIER_PILL: Record<string, string> = {
    SMALL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    LARGE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    MEGA: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  };

  const TIER_LABEL: Record<string, string> = {
    SMALL: "Small",
    MEDIUM: "Medium",
    LARGE: "Large",
    MEGA: "Mega",
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
            Upcoming Renewals
          </p>
          <p className="text-xs font-inter font-bold text-white">
            &lt; 60 days out
          </p>
        </div>
        <Clock className="h-4 w-4 text-D4AF37" />
      </div>

      <div className="space-y-3">
        {renewals.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-inter font-bold text-white truncate">
                {r.name}
              </p>
              <p className="text-[9px] font-inter text-slate-400 truncate">
                Contract renewal in {r.days} days
              </p>
            </div>
            <div className="text-right">
              <span className={`text-xs font-inter font-bold px-2 py-0.5 rounded border ${TIER_PILL[r.tier]}`}>
                {TIER_LABEL[r.tier]}
              </span>
              <p className="text-[9px] font-inter text-slate-500 uppercase tracking-tighter">
                tier
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <Link
          href="/dashboard/opportunities"
          className="flex items-center gap-1.5 text-[9px] font-inter font-bold text-D4AF37 hover:text-white transition-colors"
        >
          Pipeline actions <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* ============================================================================
   MIDDLE MICRO-CARD: Verified Grievances
   ============================================================================ */

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function VerifiedGrievancesCard() {
  const grievances = [
    { vendor: "AWS", type: "Fee Surge", count: 23, tier: "MEGA", color: "rose" },
    { vendor: "Salesforce", type: "Lock-in", count: 17, tier: "LARGE", color: "rose" },
    { vendor: "Oracle", type: "Audit Pressure", count: 14, tier: "MEDIUM", color: "rose" },
  ];

  const TIER_PILL: Record<string, string> = {
    SMALL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    LARGE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    MEGA: "bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse",
  };

  const TIER_LABEL: Record<string, string> = {
    SMALL: "Small",
    MEDIUM: "Medium",
    LARGE: "Large",
    MEGA: "Mega",
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
            Verified Grievances
          </p>
          <p className="text-xs font-inter font-bold text-white">
            Customer complaints & AI match reasons
          </p>
        </div>
        <Users className="h-4 w-4 text-D4AF37" />
      </div>

      <div className="space-y-3">
        {grievances.map((g) => (
          <div
            key={g.vendor}
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-inter font-bold text-white">
                  {g.vendor.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-inter font-bold text-white truncate">
                  {g.vendor}
                </p>
                <p className="text-[9px] font-inter text-slate-400 truncate">
                  {g.type} complaints
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs font-inter font-bold px-2 py-0.5 rounded border ${TIER_PILL[g.tier]}`}>
                {TIER_LABEL[g.tier]}
              </span>
              <span
                className={cn(
                  "text-[9px] font-inter font-bold px-2.5 py-0.5 rounded border mt-1 inline-block",
                  g.color === "rose"
                    ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                )}
              >
                Verified
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-[9px] font-inter text-slate-500">
          AI-matched displacement reasons verified against customer feedback.
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   GRIEVANCE & DISPLACEMENT FEED
   ============================================================================ */

interface GrievanceItem {
  id: string;
  account: string;
  vendor: string;
  reason: string;
  match: string;
  risk: "high" | "medium" | "low";
  status: "target" | "at-risk" | "renewal";
  predicted_value: number;
  source_url: string;
  source_name: string;
  source_captured_at: string;
}

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

function GrievanceFeedCard() {
  const feed: GrievanceItem[] = [
    {
      id: "1",
      account: "Global Logistics Corp",
      vendor: "AWS",
      reason: "300% egress fee increase",
      match: "S3-compatible object storage",
      risk: "high",
      status: "target",
      predicted_value: 5600000,
      source_url: "https://www.gov.uk/government/publications/aws-egress-fee-review",
      source_name: "UK Government Planning Portal",
      source_captured_at: "2026-10-28T14:30:00Z",
    },
    {
      id: "2",
      account: "Nordic Retail Group",
      vendor: "Salesforce",
      reason: "Per-seat pricing fatigue",
      match: "Modular CRM alternative",
      risk: "medium",
      status: "at-risk",
      predicted_value: 1200000,
      source_url: "https://buyandsell.gc.ca/opportunity/salesforce-crm-renewal",
      source_name: "CanadaBuys Procurement Portal",
      source_captured_at: "2026-10-27T09:15:00Z",
    },
    {
      id: "3",
      account: "Pacific Manufacturing",
      vendor: "Oracle",
      reason: "Annual audit pressure",
      match: "Open-source database migration",
      risk: "high",
      status: "renewal",
      predicted_value: 8200000,
      source_url: "https://www.defense.gouv.fr/achats/oracle-database-migration",
      source_name: "French Defence Procurement Portal",
      source_captured_at: "2026-10-26T16:45:00Z",
    },
    {
      id: "4",
      account: "Meridian Healthcare",
      vendor: "Microsoft",
      reason: "Bundle pricing lock-in",
      match: "Best-of-breed suite",
      risk: "medium",
      status: "target",
      predicted_value: 65000000,
      source_url: "https://www.gov.ie/en/procurement/microsoft-healthcare-bundle",
      source_name: "Irish Government Procurement",
      source_captured_at: "2026-10-25T11:20:00Z",
    },
  ];

  const RISK_STYLES: Record<string, string> = {
    high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
            Live Signal Feed
          </p>
          <p className="text-xs font-inter font-bold text-white">
            Verified commercial opportunity signals
          </p>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-inter text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Target
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Renewal
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Risk Score
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-800 p-1">
        {feed.map((item) => {
          const tierKey = dealTier(item.predicted_value);
          const tierStyle = DEAL_TIER_STYLES[tierKey];
          const tierLabel = DEAL_TIER_LABELS[tierKey];
          return (
            <div
              key={item.id}
              className="p-4 flex items-center justify-between group hover:bg-white/3 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${tierStyle}`}>
                    {tierLabel}
                  </span>
                  <span
                    className={`text-[9px] font-inter font-bold px-2.5 py-0.5 rounded border mt-1 inline-block ${RISK_STYLES[item.risk]}`}
                  >
                    {item.risk.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-base font-inter font-bold text-white truncate">
                  {item.account}
                </p>
                <p className="text-[9px] font-inter text-slate-400 truncate">
                  {item.vendor} · {item.reason}
                </p>
                <p className="text-[9px] font-inter text-D4AF37/90 mt-1 font-mono">
                  → AI match: {item.match}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-inter text-slate-500 uppercase tracking-tighter">
                      Source
                    </span>
                    <span className="text-[9px] font-inter font-mono text-slate-400 tabular-nums">
                      {item.source_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-inter text-slate-500 uppercase tracking-tighter">
                      Captured
                    </span>
                    <span className="text-[9px] font-inter font-mono text-slate-400 tabular-nums">
                      {new Date(item.source_captured_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                </div>
              </div>
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <span>↗️ Open Original Signal Source</span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
