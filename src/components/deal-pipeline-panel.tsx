"use client";

import * as React from "react";
import { ChevronRight, Briefcase } from "lucide-react";

interface Deal {
  id: string;
  title: string;
  buyer: string;
  sector: string;
  region: string;
  stage: string;
  value: number;
  currency: string;
  updated: string;
}

interface DealPipelinePanelProps {
  compact?: boolean;
  deals?: Deal[];
}

const STAGE_LABELS: Record<string, string> = {
  reviewing: "Reviewing",
  pursuing: "Pursuing",
  shortlisted: "Shortlisted",
  archived: "Archived",
};

const STAGE_COLORS: Record<string, string> = {
  reviewing: "text-slate-400 border-slate-500/30",
  pursuing: "text-D4AF37 border-D4AF37/30 bg-D4AF37/5",
  shortlisted: "text-D4AF37 border-D4AF37/30 bg-D4AF37/5",
  archived: "text-slate-500 border-white/10",
};

export function DealPipelinePanel({ compact = false, deals = [] }: DealPipelinePanelProps) {
  return (
    <div className={`glass-card ${compact ? "p-3" : "p-4"} h-full min-w-0`}>
      <div className={`flex items-center justify-between mb-3 ${compact ? "mb-2" : ""}`}>
        <div className="flex items-center gap-2">
          <Briefcase className={`h-4 w-4 ${compact ? "h-3 w-3" : ""} text-slate-400`} />
          <span className={`text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 ${compact ? "text-xs" : ""}`}>
            Deal Pipeline
          </span>
        </div>
        <span className="text-[10px] font-inter font-mono text-D4AF37 tabular-nums">
          {deals.length} Active
        </span>
      </div>

      <div className="space-y-2">
        {deals.map((deal) => (
          <div key={deal.id} className="flex items-start gap-2 p-2 border border-white/5 bg-white/5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer">
            <div className="flex-shrink-0">
              <span className={`text-[9px] font-inter font-semibold ${STAGE_COLORS[deal.stage]}`}>
                {STAGE_LABELS[deal.stage]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-inter font-semibold text-[#E5E5EA] truncate">{deal.title}</p>
              <p className="text-[10px] font-inter font-mono text-slate-400 tabular-nums">{deal.buyer}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-inter font-mono text-slate-500 tabular-nums">{deal.region}</span>
                <span className="text-[9px] font-inter font-mono text-D4AF37 tabular-nums">£{deal.value.toLocaleString()}</span>
              </div>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-600 flex-shrink-0" />
          </div>
        ))}
      </div>

      {deals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <span className="text-[10px] font-inter text-slate-500">No active deals</span>
        </div>
      )}
    </div>
  );
}
