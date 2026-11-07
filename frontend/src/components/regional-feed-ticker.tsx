"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface Adapter {
  code: string;
  region: string;
  authority: string;
  latency: string;
}

interface RegionalFeedTickerProps {
  adapters: Adapter[];
}

const SECTORS = [
  "DEFENCE",
  "HEALTHCARE",
  "INFRASTRUCTURE",
  "TRANSPORT",
  "ENERGY",
  "DIGITAL",
  "CONSTRUCTION",
  "LOGISTICS",
];

function pseudoLatency(code: string): string {
  const hash = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const ms = 150 + (hash % 300);
  return `${ms}MS`;
}

export function RegionalFeedTicker({ adapters }: RegionalFeedTickerProps) {
  const [highlighted, setHighlighted] = React.useState<string | null>(null);

  return (
    <section className="relative bg-[#09090B] overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adapters.map((adapter) => {
            const isActive = highlighted === adapter.code;
            return (
              <motion.div
                key={adapter.code}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onMouseEnter={() => setHighlighted(adapter.code)}
                onMouseLeave={() => setHighlighted(null)}
                className={`relative px-5 py-4 border rounded-none transition-all duration-200 ${
                  isActive
                    ? "border-white bg-white/[0.02] shadow-[0_0_24px_rgba(255,255,255,0.04)]"
                    : "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-white">
                    {adapter.code}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                      isActive
                        ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)] animate-pulse"
                        : "bg-white/20"
                    }`}
                  />
                </div>
                <p className="text-[9px] font-sans text-[#94A3B8] uppercase tracking-[0.1em] leading-tight">
                  {adapter.authority}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#94A3B8] tabular-nums">
                    {pseudoLatency(adapter.code)}
                  </span>
                  <span className="ml-auto text-[9px] font-mono text-[#6B7280] uppercase tracking-[0.08em]">
                    {adapter.region}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
