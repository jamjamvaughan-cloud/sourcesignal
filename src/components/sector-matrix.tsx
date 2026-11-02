"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { MACRO_SECTORS, type MacroSectorId } from "@/lib/config/sectors";

export function SectorMatrix() {
  const [expandedMacro, setExpandedMacro] = React.useState<Set<MacroSectorId>>(
    new Set(),
  );

  const toggleMacro = (id: MacroSectorId) => {
    setExpandedMacro((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isExpanded = (id: MacroSectorId) => expandedMacro.has(id);

  return (
    <div className="glass-card p-4 section-enter max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="section-kicker">Sector Matrix</div>
      </div>

      <div className="grid gap-2">
        {MACRO_SECTORS.map((macroSector) => {
          const isOpen = isExpanded(macroSector.id as MacroSectorId);

          return (
            <div key={macroSector.id} className="card-container p-3 glass-hover">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer group"
                onClick={() => toggleMacro(macroSector.id as MacroSectorId)}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""} text-slate-400`}>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-inter font-bold text-[#E5E5EA]">
                      {macroSector.name}
                    </span>
                    <span className="text-[9px] font-inter font-mono text-slate-500">
                      {macroSector.subIndustries.length} sub-sectors
                    </span>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="grid grid-cols-3 gap-2 mt-2 border-t border-white/5 pt-2 animate-in">
                  {macroSector.subIndustries.map((sub) => (
                    <div key={sub.id} className="p-2 border border-white/5 bg-white/5 rounded-sm">
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-[9px] font-inter font-semibold text-[#E5E5EA]">
                          {sub.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
