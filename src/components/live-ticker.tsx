"use client";

import * as React from "react";

export function LiveTicker() {
  return (
    <div className="glass-panel h-10 overflow-hidden section-enter max-w-full min-w-0">
      <div className="flex items-center gap-3 px-3 py-1 border-b border-white/5 bg-[#09090b]/40">
        <span className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">market intelligence</span>
        <span className="h-[1px] w-1 bg-white/20" />
        <span className="text-[10px] font-inter font-mono text-slate-400 tabular-nums">live signals</span>
        <span className="text-D4AF37 font-inter font-mono text-[10px] tabular-nums">—</span>
      </div>
      <div className="overflow-x-hidden h-[5rem]">
        <div className="flex gap-8 animate-[ticker_15s_linear_infinite]">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[10px] font-inter font-mono text-slate-400 tabular-nums">No live signals</span>
          </div>
        </div>
      </div>
    </div>
  );
}
