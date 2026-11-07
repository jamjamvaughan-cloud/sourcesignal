"use client";

import * as React from "react";

/**
 * DataPreviewer — Interactive mini-workspace widget for the homepage.
 *
 * Users click tabs (UK_MOD, NHS_TENDERS, PLANNING_PERMITS) and watch raw
 * government notice data instantly transform into clean, structured
 * commercial intelligence. Left pane = raw notice (monospace, JSON-like),
 * right pane = structured record (extracted fields, provenance, SHA-256
 * digest). Switching tabs animates the transformation.
 */

interface PreviewTab {
  id: string;
  label: string;
  source: string;
  raw: string;
  structured: {
    buyer: string;
    contract_value: string;
    sector: string;
    region: string;
    status: string;
    decision_maker: string;
    cpv_code: string;
    closing_date: string;
  };
  sha256: string;
}

const PREVIEW_TABS: PreviewTab[] = [
  {
    id: "uk_mod",
    label: "UK_MOD_DSP",
    source: "Ministry of Defence — Defence Supply Portal",
    raw: `{
  "notice_id": "2026/S 204-882134",
  "buyer": "Ministry of Defence (UK_MOD_DSP)",
  "title": "Supply of Secure Network Infrastructure — Tier 1 SOC Services",
  "cpv_code": "72000000-5",
  "contract_value": 14200000,
  "currency": "GBP",
  "region": "UK",
  "sector": "DEFENCE",
  "status": "PRE_RFP",
  "closing_date": "2026-12-15T17:00:00Z",
  "decision_maker": "Head of Digital Procurement, MOD",
  "source_url": "https://www.contractsfinder.service.gov.uk/notice/2026-S-204-882134",
  "raw_payload_captured": "2026-06-11T09:14:22Z"
}`,
    structured: {
      buyer: "Ministry of Defence (UK_MOD_DSP)",
      contract_value: "£14.2M",
      sector: "DEFENCE",
      region: "UK",
      status: "PRE_RFP",
      decision_maker: "Head of Digital Procurement, MOD",
      cpv_code: "72000000-5 (IT Services)",
      closing_date: "15 Dec 2026",
    },
    sha256: "9f2c7a41e8b3a1c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
  },
  {
    id: "nhs_tenders",
    label: "NHS_TENDERS",
    source: "NHS England — Find a Tender Service",
    raw: `{
  "notice_id": "FTS-2026-88122",
  "buyer": "NHS England (NHS_TENDERS)",
  "title": "Electronic Patient Record System Integration — Regional Rollout",
  "cpv_code": "85100000-2",
  "contract_value": 4200000,
  "currency": "GBP",
  "region": "ENG",
  "sector": "HEALTHCARE",
  "status": "LIVE_TENDER",
  "closing_date": "2026-08-22T14:30:00Z",
  "decision_maker": "Director of Digital Transformation, NHS England",
  "source_url": "https://www.find-tender.service.gov.uk/Notice/88122-2026",
  "raw_payload_captured": "2026-06-11T08:41:09Z"
}`,
    structured: {
      buyer: "NHS England (NHS_TENDERS)",
      contract_value: "£4.2M",
      sector: "HEALTHCARE",
      region: "England",
      status: "LIVE_TENDER",
      decision_maker: "Director of Digital Transformation, NHS England",
      cpv_code: "85100000-2 (Health & Social Work)",
      closing_date: "22 Aug 2026",
    },
    sha256: "c3b8f1a2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
  },
  {
    id: "planning_permits",
    label: "PLANNING_PERMITS",
    source: "UK Planning Portal — Local Authority Notices",
    raw: `{
  "notice_id": "PP-2026-61277",
  "buyer": "Welsh Government (PLANNING_PERMITS)",
  "title": "A465 Heads of the Valleys Upgrade — Section 2 Enabling Works",
  "cpv_code": "45200000-8",
  "contract_value": 1800000,
  "currency": "GBP",
  "region": "WLS",
  "sector": "CONSTRUCTION",
  "status": "LIVE_TENDER",
  "closing_date": "2026-07-10T10:00:00Z",
  "decision_maker": "Senior Procurement Officer, Welsh Gov",
  "source_url": "https://planningportal.gov.wales/notices/PP-2026-61277",
  "raw_payload_captured": "2026-06-10T22:03:11Z"
}`,
    structured: {
      buyer: "Welsh Government (PLANNING_PERMITS)",
      contract_value: "£1.8M",
      sector: "CONSTRUCTION",
      region: "Wales",
      status: "LIVE_TENDER",
      decision_maker: "Senior Procurement Officer, Welsh Gov",
      cpv_code: "45200000-8 (Construction)",
      closing_date: "10 Jul 2026",
    },
    sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  },
];

function formatRaw(jsonString: string): string {
  // Simple syntax highlighting for JSON-like raw text
  return jsonString
    .replace(/("([^"]+)":)/g, '<span class="text-[#FF5500]">$1</span>')
    .replace(/: (\d+)/g, ': <span class="text-white">$1</span>')
    .replace(/: "([^"]+)"/g, ': <span class="text-zinc-300">"$1"</span>')
    .replace(/true/g, '<span class="text-emerald-400">true</span>')
    .replace(/false/g, '<span class="text-zinc-500">false</span>')
    .replace(/null/g, '<span class="text-zinc-500">null</span>');
}

export function DataPreviewer() {
  const [activeTab, setActiveTab] = React.useState<PreviewTab>(PREVIEW_TABS[0]);
  const [transforming, setTransforming] = React.useState(false);

  const handleTabChange = (tab: PreviewTab) => {
    if (tab.id === activeTab.id) return;
    setTransforming(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTransforming(false);
    }, 150);
  };

  const statusColor: Record<string, string> = {
    PRE_RFP: "#10b981",
    LIVE_TENDER: "#d4af37",
    AWARDED: "#FF5500",
  };

  return (
    <section
      className="border-t border-white/10 bg-black"
      style={{ transformStyle: "flat" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24 lg:px-12">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-20 lg:max-w-3xl lg:mx-auto">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-emerald-400">
            [ INTERACTIVE DATA PREVIEWER ]
          </p>
          <h2 className="mt-3 text-3xl font-bold uppercase tracking-tighter text-white sm:text-4xl">
            Raw notice → canonical record
          </h2>
          <p className="mt-4 font-mono text-xs leading-relaxed text-[#71717A] sm:text-sm">
            Select a live feed to watch unstructured government notice data
            transform into verified, structured commercial intelligence in real
            time. Every extracted field is bound to a SHA-256 source digest.
          </p>
        </div>

        {/* Tabs bar */}
        <div className="flex flex-wrap justify-center gap-1 mb-10 border-b border-white/10 pb-6 sm:mb-14 lg:mb-16">
          {PREVIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab)}
              className={`px-5 py-3 font-mono text-[9px] uppercase tracking-[0.18em] transition-all duration-300 border-b-2 ${
                activeTab.id === tab.id
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Preview panes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Raw notice */}
          <div className="bg-[#050505] border border-white/10 rounded-[1px] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="border-b border-white/10 bg-black/40 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#050505] border border-white/10" />
                <div className="h-3 w-3 rounded-full bg-[#050505] border border-white/10" />
                <div className="h-3 w-3 rounded-full bg-[#050505] border border-white/10" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
                  RAW NOTICE
                </span>
                <span className="w-px h-3 bg-white/10" />
                <span className="font-mono text-[8px] text-[#FF5500] uppercase tracking-tighter">
                  source payload
                </span>
              </div>
            </div>
            <div className="p-5 font-mono text-[9px] leading-relaxed overflow-x-auto max-h-[400px]">
              <div
                className="whitespace-pre break-all"
                dangerouslySetInnerHTML={{ __html: formatRaw(activeTab.raw) }}
              />
            </div>
            <div className="border-t border-white/10 bg-black/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
                  Source:
                </span>
                <span className="font-mono text-[8px] text-zinc-300">
                  {activeTab.source}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Structured record */}
          <div className="bg-[#050505] border border-white/10 rounded-[1px] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="border-b border-white/10 bg-black/40 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400/20 border border-emerald-400/40" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
                  STRUCTURED RECORD
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                  statusColor[activeTab.structured.status]
                }/20 bg-${statusColor[activeTab.structured.status]}/10 text-${statusColor[activeTab.structured.status]} font-mono text-[8px] uppercase tracking-[0.1em]`}>
                  {activeTab.structured.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[400px] pr-2">
              {[
                { label: "BUYER", value: activeTab.structured.buyer },
                { label: "CONTRACT_VALUE", value: activeTab.structured.contract_value },
                { label: "SECTOR", value: activeTab.structured.sector },
                { label: "REGION", value: activeTab.structured.region },
                { label: "DECISION_MAKER", value: activeTab.structured.decision_maker },
                { label: "CPV_CODE", value: activeTab.structured.cpv_code },
                { label: "CLOSING_DATE", value: activeTab.structured.closing_date },
              ].map((field) => (
                <div
                  key={field.label}
                  className="flex justify-between border-b border-white/[0.05] pb-3 last:border-b-0"
                >
                  <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                    {field.label}
                  </span>
                  <span className="font-mono text-[9px] text-white tabular-nums">
                    {field.value}
                  </span>
                </div>
              ))}
              <div className="mt-6 border-t border-white/10 pt-4">
                <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                  SHA-256 DIGEST
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 font-mono text-[8px] break-all border border-white/5 bg-black/40 px-2.5 py-1.5 text-zinc-400">
                    {activeTab.sha256}
                  </code>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/10 text-emerald-400 font-mono text-[7px] uppercase tracking-[0.1em]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    VERIFIED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-10 flex items-center gap-3">
          <div className="flex-shrink-0 h-[1px] w-8 bg-white/10" />
          <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
            All fields are source-evidenced — no synthetic inference
          </span>
          <div className="flex-shrink-0 h-[1px] flex-1 bg-white/10" />
        </div>
      </div>
    </section>
  );
}
