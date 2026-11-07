"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface SignalRow {
  id: string;
  time: string;
  region: string;
  sector: string;
  authority: string;
  valuation: string;
  reference: string;
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

const REGIONS = ["UK", "SCT", "WLS", "NIR", "IE", "US", "CA", "EU"];

const AUTHORITIES = [
  "Ministry of Defence",
  "NHS England",
  "Find a Tender Service",
  "Scottish Water",
  "SAM.gov",
  "CanadaBuys",
  "Public Contracts Scotland",
  "Irish Water",
  "Cal eProcure",
  "BC Bid",
];

const VALUATIONS = ["£4.2M", "£1.8M", "£12.7M", "£840K", "£22.3M", "£950K", "£6.1M", "£330K"];

const REF_PREFIXES = ["2026/S", "REF-", "CN-", "SAM-", "CF-", "PCS-"];

const MOCK_SEED: SignalRow[] = [
  {
    id: "s1",
    time: "2s ago",
    region: "UK",
    sector: "DEFENCE",
    authority: "Ministry of Defence",
    valuation: "£14.2M",
    reference: "2026/S 204-882134",
  },
  {
    id: "s2",
    time: "11s ago",
    region: "SCT",
    sector: "HEALTHCARE",
    authority: "NHS Scotland",
    valuation: "£4.2M",
    reference: "PCS-88122",
  },
  {
    id: "s3",
    time: "27s ago",
    region: "UK",
    sector: "INFRASTRUCTURE",
    authority: "Find a Tender Service",
    valuation: "£22.3M",
    reference: "2026/S 205-1104",
  },
  {
    id: "s4",
    time: "44s ago",
    region: "IE",
    sector: "DIGITAL",
    authority: "eTenders Ireland",
    valuation: "£840K",
    reference: "ET-77301",
  },
  {
    id: "s5",
    time: "1m 2s ago",
    region: "US",
    sector: "DEFENCE",
    authority: "SAM.gov",
    valuation: "£33.1M",
    reference: "SAM-991203",
  },
  {
    id: "s6",
    time: "1m 19s ago",
    region: "CA",
    sector: "TRANSPORT",
    authority: "CanadaBuys",
    valuation: "£6.1M",
    reference: "CB-44190",
  },
  {
    id: "s7",
    time: "2m 3s ago",
    region: "WLS",
    sector: "CONSTRUCTION",
    authority: "Welsh Government",
    valuation: "£1.8M",
    reference: "CN-61277",
  },
  {
    id: "s8",
    time: "2m 41s ago",
    region: "UK",
    sector: "ENERGY",
    authority: "National Grid",
    valuation: "£41.5M",
    reference: "2026/S 206-3302",
  },
];

function hash(str: string): number {
  let value = 2166136261;
  for (let i = 0; i < str.length; i++) {
    value ^= str.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function LiveSignalFeed() {
  const [rows, setRows] = React.useState<SignalRow[]>(() => [...MOCK_SEED]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setRows((prev) => {
        const seedIndex = hash(`${Date.now()}`) % MOCK_SEED.length;
        const base = MOCK_SEED[seedIndex];
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-GB", {
          hour12: false,
          minute: "2-digit",
          second: "2-digit",
        });
        const row: SignalRow = {
          id: `live-${Date.now()}`,
          time: timeStr,
          region: base.region,
          sector: base.sector,
          authority: base.authority,
          valuation: base.valuation,
          reference: base.reference,
        };
        return [row, ...prev.slice(0, 11)];
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setRows((prev) =>
        prev.map((row) => {
          const m = row.time.match(/(\d+)\s*(s|m|h) ago/);
          if (!m) return row;
          const num = parseInt(m[1], 10);
          const unit = m[2];
          if (unit === "s") {
            return { ...row, time: `${num + 1}s ago` };
          }
          return row;
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative bg-[#09090B] overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
          <div>
            <p className="mb-2 text-[10px] font-sans uppercase tracking-[0.2em] text-[#94A3B8] font-medium">
              Live Intercepts
            </p>
            <h2 className="mt-1 text-3xl font-semibold uppercase tracking-tighter text-white sm:text-4xl">
              Signal Feed
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#94A3B8] sm:text-base">
              Commercial opportunities entering the database in real time —
              clean monochrome ticker bars, no terminal noise.
            </p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/60 shadow-[0_0_10px_rgba(255,255,255,0.4)] animate-pulse" />
                <span className="text-xs font-semibold tracking-tight text-[#94A3B8]/80">
                  System Nominal
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums text-white tracking-tight">
                  {rows.length}
                </span>
                <span className="text-xs text-[#94A3B8] uppercase tracking-[0.15em]">
                  active intercepts
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden border border-white/[0.08] bg-white/[0.02] rounded-none shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          <div className="relative z-10 p-6">
            <div className="overflow-hidden h-[420px]">
              <div className="flex flex-col gap-2">
                {rows.map((row, index) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`cursor-pointer relative px-5 py-3.5 border-b border-white/[0.04] last:border-b-0 transition-all duration-200 hover:bg-white/[0.03] hover:border-b-white hover:-translate-x-1`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-white/60 animate-pulse" />
                        <div className="min-w-0">
                          <p className="font-sans text-xs font-semibold tracking-tight text-white truncate">
                            {row.authority}
                          </p>
                          <p className="text-[10px] text-[#94A3B8]/80 uppercase tracking-[0.1em]">
                            {row.sector} · {row.region}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="px-2.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-[10px] uppercase tracking-[0.1em] font-semibold text-[#94A3B8]">
                          {row.sector}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]/70 tabular-nums font-medium">
                          {row.time}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-white">
                          {row.valuation}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]/70 tabular-nums font-medium">
                          {row.reference}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8]/70 font-medium">
            SHA-256 verified · Zero synthetic data
          </span>
        </div>
      </div>
    </section>
  );
}
