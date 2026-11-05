"use client";

import * as React from "react";

interface KPIMetric {
  label: string;
  value: string | number;
  delta?: string;
  deltaTrend?: "up" | "down" | "neutral";
}

const TREND_STYLES: Record<string, string> = {
  up: "text-D4AF37 border-D4AF37/20 bg-D4AF37/5",
  down: "text-[#7F1D1D] border-[#7F1D1D]/20 bg-[#7F1D1D]/5",
  neutral: "text-slate-500 border-white/10 bg-white/5",
};

const LABEL_STYLE = "text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500";

const KPI_DELTAS: KPIMetric[] = [
  { label: "total pipeline value", value: "", delta: "+12.4%", deltaTrend: "up" },
  { label: "active tenders", value: "", delta: "+8.3%", deltaTrend: "up" },
  { label: "high-value matches", value: "", delta: "+3.2%", deltaTrend: "up" },
  { label: "capex velocity", value: "", delta: "+7.1%", deltaTrend: "neutral" },
];

export function ExecutiveKPIHeader({
  metrics,
}: {
  metrics: {
    totalPipeline: number;
    activeSignals: number;
    highMatchCount: number;
    capexVelocity: number;
  };
}) {
  const kpis: KPIMetric[] = [
    {
      label: "total pipeline value",
      value: `£${metrics.totalPipeline.toLocaleString()}`,
      delta: KPI_DELTAS[0].delta,
      deltaTrend: KPI_DELTAS[0].deltaTrend,
    },
    {
      label: "active tenders",
      value: metrics.activeSignals.toLocaleString(),
      delta: KPI_DELTAS[1].delta,
      deltaTrend: KPI_DELTAS[1].deltaTrend,
    },
    {
      label: "high-value matches",
      value: metrics.highMatchCount.toLocaleString(),
      delta: KPI_DELTAS[2].delta,
      deltaTrend: KPI_DELTAS[2].deltaTrend,
    },
    {
      label: "capex velocity",
      value: `£${metrics.capexVelocity.toLocaleString()}`,
      delta: KPI_DELTAS[3].delta,
      deltaTrend: KPI_DELTAS[3].deltaTrend,
    },
  ];

  return (
    <div className="flex flex-col gap-2 p-2 lg:flex-row lg:p-0 lg:pb-2">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="glass-card flex-1 flex flex-col gap-2 px-4 py-4 lg:px-4 lg:py-4">
          <div className={LABEL_STYLE}>{kpi.label}</div>
          <div className="metric-value">{kpi.value}</div>
          <div className={`flex items-center gap-1 px-2 py-1 text-[10px] font-inter font-semibold border ${TREND_STYLES[kpi.deltaTrend ?? "neutral"]}`}>
            <span>{kpi.delta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
