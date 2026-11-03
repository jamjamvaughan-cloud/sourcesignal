/**
 * Coverage Matrix Component (Signal Coverage Matrix / Transparency Dashboard).
 *
 * Displays ingestion health metrics: adapters monitored, signals by
 * country/sector/tier, latest ingestion run, uptime, and vulnerability
 * trigger distribution. Instills buyer confidence by showing exactly what
 * sources are being monitored and how fresh the data is.
 *
 * All data is fetched from the backend API (/api/coverage) — never from
 * PostgreSQL directly — so this component works on the Vercel frontend
 * deployment without any database credentials.
 */

import { backendJson } from "@/lib/backend";

interface CoverageData {
  adapters: {
    total: number;
    byCountry: Array<{ country: string; count: number }>;
  };
  signals: {
    total: number;
    byTier: Array<{ tier: string; count: number }>;
    byCountry: Array<{ country: string; count: number }>;
    bySector: Array<{ sector: string; count: number }>;
    byTrigger: Array<{ trigger: string; count: number }>;
  };
  ingestion: {
    lastRun: {
      id: string;
      status: string;
      recordsProcessed: number;
      signalsProcessed: number;
      executedAt: Date | null;
      completedAt: Date | null;
    } | null;
    latestSignalCapturedAt: Date | null;
  };
  uptime: string;
}

async function fetchCoverageData(): Promise<CoverageData> {
  const result = await backendJson<CoverageData>("/api/coverage");

  return (
    result ?? {
      adapters: { total: 0, byCountry: [] },
      signals: {
        total: 0,
        byTier: [],
        byCountry: [],
        bySector: [],
        byTrigger: [],
      },
      ingestion: { lastRun: null, latestSignalCapturedAt: null },
      uptime: "0.0%",
    }
  );
}

export default async function CoverageMatrix() {
  const data = await fetchCoverageData();

  const tierColors: Record<string, string> = {
    MEGAPROCUREMENT: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    HIGH_CAP: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    STANDARD_COMMERCIAL: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
            Coverage Matrix
          </p>
          <p className="text-xs font-inter font-bold text-white">
            Signal Coverage & Ingestion Health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-inter font-bold text-emerald-400">
            {data.uptime} Uptime
          </span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Adapters */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Adapters Monitored
          </p>
          <p className="text-2xl font-inter font-bold text-white font-mono tabular-nums">
            {data.adapters.total}
          </p>
          <p className="text-[9px] font-inter text-slate-400 mt-1">
            {data.adapters.byCountry.map((a) => `${a.country}: ${a.count}`).join(" · ")}
          </p>
        </div>

        {/* Total Signals */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Total Signals
          </p>
          <p className="text-2xl font-inter font-bold text-white font-mono tabular-nums">
            {data.signals.total}
          </p>
          <p className="text-[9px] font-inter text-slate-400 mt-1">
            Active procurement signals
          </p>
        </div>

        {/* Last Ingestion */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Last Ingestion
          </p>
          <p className="text-2xl font-inter font-bold text-white font-mono tabular-nums">
            {data.ingestion.lastRun?.signalsProcessed ?? 0}
          </p>
          <p className="text-[9px] font-inter text-slate-400 mt-1">
            {data.ingestion.lastRun?.status?.toUpperCase() ?? "—"}
          </p>
        </div>

        {/* Latest Signal */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Latest Signal
          </p>
          <p className="text-2xl font-inter font-bold text-white font-mono tabular-nums">
            {data.ingestion.latestSignalCapturedAt
              ? new Date(data.ingestion.latestSignalCapturedAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
              : "—"}
          </p>
          <p className="text-[9px] font-inter text-slate-400 mt-1">
            Most recent capture
          </p>
        </div>
      </div>

      <div className="p-6 border-t border-slate-800">
        <div className="flex flex-wrap gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Signals by Tier
            </p>
            <div className="space-y-1">
              {data.signals.byTier.map((t) => (
                <div key={t.tier} className="flex items-center justify-between text-sm">
                  <span className="font-inter font-mono text-slate-300 tabular-nums">
                    {t.tier}
                  </span>
                  <span className={`font-inter font-bold text-xs px-2 py-0.5 rounded border ${tierColors[t.tier] ?? "bg-white/5 text-white border-white/10"}`}>
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Signals by Country
            </p>
            <div className="space-y-1">
              {data.signals.byCountry.map((c) => (
                <div key={c.country} className="flex items-center justify-between text-sm">
                  <span className="font-inter font-mono text-slate-300 tabular-nums">
                    {c.country}
                  </span>
                  <span className="font-inter font-bold text-xs text-white tabular-nums">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Signals by Sector
            </p>
            <div className="space-y-1">
              {data.signals.bySector.map((s) => (
                <div key={s.sector} className="flex items-center justify-between text-sm">
                  <span className="font-inter font-mono text-slate-300 tabular-nums">
                    {s.sector}
                  </span>
                  <span className="font-inter font-bold text-xs text-white tabular-nums">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Displacement Triggers
            </p>
            <div className="space-y-1">
              {data.signals.byTrigger.map((t) => (
                <div key={t.trigger} className="flex items-center justify-between text-sm">
                  <span className="font-inter font-mono text-slate-300 tabular-nums">
                    {t.trigger}
                  </span>
                  <span className={`font-inter font-bold text-xs px-2 py-0.5 rounded border ${getVulnerabilityStyle(t.trigger)}`}>
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
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
