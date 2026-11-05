"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface TierFilterBarProps {
  selectedTier: string;
  tierStyles: Record<string, string>;
}

export function TierFilterBar({
  selectedTier,
  tierStyles,
}: TierFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTierChange = (tier: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tier", tier);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="glass-card p-4 rounded-2xl border border-slate-800">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
          Filter by deal size
        </p>
        <div className="flex flex-wrap gap-2 max-w-full">
          {[
            { id: "all", label: "All Deals" },
            { id: "SMALL", label: "Small (£50K–£500K)" },
            { id: "MEDIUM", label: "Medium (£500K–£5M)" },
            { id: "LARGE", label: "Large (£5M–£50M)" },
            { id: "MEGA", label: "Mega (£50M–£500M+)" },
          ].map((t) => {
            const isActive = selectedTier === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTierChange(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-inter font-bold transition-all duration-200 ease-out whitespace-nowrap ${
                  isActive
                    ? tierStyles[t.id as keyof typeof tierStyles] +
                      " shadow-lg"
                    : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
