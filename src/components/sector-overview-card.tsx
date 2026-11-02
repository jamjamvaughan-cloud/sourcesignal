"use client";

import * as React from "react";

interface SectorCardProps {
  sector: {
    id: string;
    name: string;
    description?: string;
  };
  activeOpportunities: number;
  aggregateValue: number;
  trend: "up" | "down" | "neutral";
  trendPercent: number;
}

const SECTOR_COLORS: Record<string, string> = {
  construction: "#3b82f6",
  infrastructure: "#8b5cf6",
  energy: "#f59e0b",
  "industrial-and-manufacturing": "#ec4899",
  "logistics-and-distribution": "#10b981",
  "technology-infrastructure": "#6366f1",
  "property-and-real-estate": "#14b8a6",
  engineering: "#a855f7",
  "facilities-management": "#f97316",
  transport: "#ef4444",
  "water-and-environment": "#0ea5e9",
  telecommunications: "#8b5cf6",
  "healthcare-infrastructure": "#10b981",
  "defence-and-aerospace": "#dc2626",
  "public-sector-services": "#2563eb",
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `£${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(1)}K`;
  return `£${value.toFixed(0)}`;
}

export function SectorCard({
  sector,
  activeOpportunities,
  aggregateValue,
  trend,
  trendPercent,
}: SectorCardProps) {
  const color = SECTOR_COLORS[sector.id] || "#94a3b8";
  const isUp = trend === "up";
  const trendColor = isUp ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-400";
  const trendLabel = isUp ? "trending up" : trend === "down" ? "trending down" : "steady";

  return (
    <div className="group relative overflow-hidden rounded-md border border-white/10 bg-[#0D131F] shadow-[0_0_30px_-10px_rgba(0,0,0,0.4)] p-3">
      <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="h-6 w-6 rounded-sm bg-white/5 flex items-center justify-center border border-white/10">
            <span className="text-[9px] font-bold" style={{ color }}>
              {sector.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border ${trendColor} ${trendColor.replace("text-", "border-")}/30 ${trendColor.replace("text-", "bg-")}/10`}>
            {trendPercent > 0 ? "+" : ""}{trendPercent}% {trendLabel}
          </div>
        </div>

        <div className="text-[9px] font-mono tracking-wider text-slate-500 uppercase mb-0.5">Active Opportunities</div>
        <div className="text-xl font-bold text-white tracking-tight mb-1">{activeOpportunities.toLocaleString()}</div>

        <div className="mt-2 pt-2 border-t border-slate-800/50">
          <div className="flex items-baseline gap-1">
            <span className="text-[9px] font-mono tracking-wider text-slate-500 uppercase">Aggregate Value</span>
            <span className="text-lg font-bold text-white tracking-tight">{formatCurrency(aggregateValue)}</span>
          </div>
          <div className="mt-1 flex w-full gap-1 overflow-hidden rounded-sm h-1 bg-slate-800/50">
            <div className={`h-full ${color} transition-all duration-700 ease-out`} style={{ width: Math.min(100, activeOpportunities * 5) }} />
          </div>
          <p className="mt-1 text-[9px] text-slate-500 font-mono tracking-wider">Pipeline coverage by sector</p>
        </div>
      </div>
    </div>
  );
}
