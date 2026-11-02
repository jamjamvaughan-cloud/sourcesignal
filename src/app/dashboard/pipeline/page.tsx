"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const deals: Array<{
  id: string;
  title: string;
  buyer: string;
  sector: string;
  region: string;
  stage: string;
  value: number;
  currency: string;
  updated: string;
}> = [];

const PIPELINE_STAGES = [
  { id: "reviewing", label: "Reviewing", color: "text-slate-400 border-slate-500/30" },
  { id: "pursuing", label: "Pursuing", color: "text-D4AF37 border-D4AF37/30 bg-D4AF37/5" },
  { id: "shortlisted", label: "Shortlisted", color: "text-D4AF37 border-D4AF37/30 bg-D4AF37/5" },
  { id: "archived", label: "Archived", color: "text-slate-500 border-white/10" },
];

const STAGE_LABELS: Record<string, string> = {
  reviewing: "Reviewing",
  pursuing: "Pursuing",
  shortlisted: "Shortlisted",
  archived: "Archived",
};

export default function PipelinePage() {
  const activeTab = "reviewing";

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
        <div>
          <h1 className="headline mb-0.5">Deal Pipeline</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Deal tracking and pursuit management.</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" className="px-4 py-2 text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out rounded-sm">
            Export Pipeline
          </Button>
        </div>
      </div>

      <div className="flex gap-1 p-1 overflow-x-auto scrollbar-hide">
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage.id}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-inter font-semibold transition-all duration-200 ease-out whitespace-nowrap ${activeTab === stage.id ? "bg-white/5 text-white border-r-2 border-r-D4AF37 filter-active" : "text-slate-400 hover:bg-white/5 hover:text-white interactive-tab"}`}
          >
            {STAGE_LABELS[stage.id]} <span className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">{deals.filter(p => p.stage === stage.id).length}</span>
          </button>
        ))}
      </div>

      {deals.filter(p => p.stage === activeTab).length === 0 ? (
        <EmptyState
          title={`No ${STAGE_LABELS[activeTab]} tenders`}
          description={`No tenders are currently in the ${STAGE_LABELS[activeTab].toLowerCase()} stage. Move tenders from other stages to track them here.`}
        />
      ) : (
        <div className="glass-card overflow-hidden max-w-full min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-[#0F0F11]">
                <tr className="border-b border-white/5 sticky top-0 z-10">
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Tender Title</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Buyer</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Sector</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Region</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right">CapEx Value</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Last Updated</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deals.filter(p => p.stage === activeTab).map((opp) => (
                  <tr key={opp.id} className="table-row">
                    <td className="px-4 py-4 text-sm font-inter font-semibold text-[#E5E5EA]">{opp.title}</td>
                    <td className="px-4 py-4 text-sm font-inter font-mono text-slate-400 tabular-nums">{opp.buyer}</td>
                    <td className="px-4 py-4 text-sm font-inter text-slate-400">{opp.sector}</td>
                    <td className="px-4 py-4 text-sm font-inter font-mono text-slate-400 tabular-nums">{opp.region}</td>
                    <td className="px-4 py-4 text-right"><span className="text-sm font-inter font-bold text-[#E5E5EA] font-mono tabular-nums">£{opp.value.toLocaleString()}</span></td>
                    <td className="px-4 py-4 text-sm font-inter font-mono text-slate-400 tabular-nums">{opp.updated}</td>
                    <td className="px-4 py-4 text-right">
                      <ChevronRight className="h-4 w-4 text-slate-600 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
