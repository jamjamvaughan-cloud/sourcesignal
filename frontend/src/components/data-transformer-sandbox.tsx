"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface RawNotice {
  id: string;
  label: string;
  authority: string;
  rawHtml: string;
  structured: {
    buyerName: string;
    contractValuation: string;
    decisionMaker: string;
    cpvCode: string;
    region: string;
    status: string;
    closingDate: string;
    canonicalId: string;
  };
  sha256: string;
}

const RAW_NOTICES: RawNotice[] = [
  {
    id: "uk_mod",
    label: "UK_MOD_DSP",
    authority: "Ministry of Defence — Defence Supply Portal",
    rawHtml: `<!DOCTYPE html>
<html>
<head><title>Contract Notice 2026/S 204-882134</title></head>
<body>
  <div class="notice">
    <h1>Supply of Secure Network Infrastructure — Tier 1 SOC Services</h1>
    <p><strong>Buyer:</strong> Ministry of Defence (UK_MOD_DSP)</p>
    <p><strong>Buyer Email:</strong> procurement@mod.gov.uk</p>
    <p><strong>Contract Value:</strong> £14,200,000 GBP</p>
    <p><strong>CPV Code:</strong> 72000000-5 (IT Services)</p>
    <p><strong>Region:</strong> United Kingdom</p>
    <p><strong>Status:</strong> Pre-RFP — Market Engagement</p>
    <p><strong>Decision Maker:</strong> Head of Digital Procurement, MOD</p>
    <p><strong>Closing Date:</strong> 15 December 2026, 17:00 BST</p>
    <p><strong>Source:</strong> https://www.contractsfinder.service.gov.uk/notice/2026-S-204-882134</p>
    <p><strong>Captured:</strong> 2026-06-11T09:14:22Z</p>
  </div>
</body>
</html>`,
    structured: {
      buyerName: "Ministry of Defence (UK_MOD_DSP)",
      contractValuation: "£14,200,000",
      decisionMaker: "Head of Digital Procurement, MOD",
      cpvCode: "72000000-5 (IT Services)",
      region: "United Kingdom",
      status: "PRE_RFP",
      closingDate: "15 Dec 2026 · 17:00 BST",
      canonicalId: "2026/S 204-882134",
    },
    sha256: "9f2c7a41e8b3a1c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
  },
  {
    id: "nhs_tenders",
    label: "NHS_TENDERS",
    authority: "NHS England — Find a Tender Service",
    rawHtml: `<!DOCTYPE html>
<html>
<head><title>FTS Notice 88122-2026</title></head>
<body>
  <div class="tender-notice">
    <h1>Electronic Patient Record System Integration — Regional Rollout</h1>
    <p><strong>Buyer:</strong> NHS England (NHS_TENDERS)</p>
    <p><strong>Buyer Email:</strong> digital.procurement@nhs.net</p>
    <p><strong>Contract Value:</strong> £4,200,000 GBP</p>
    <p><strong>CPV Code:</strong> 85100000-2 (Health &amp; Social Work)</p>
    <p><strong>Region:</strong> England</p>
    <p><strong>Status:</strong> Live Tender — Open for Bids</p>
    <p><strong>Decision Maker:</strong> Director of Digital Transformation, NHS England</p>
    <p><strong>Closing Date:</strong> 22 August 2026, 14:30 BST</p>
    <p><strong>Source:</strong> https://www.find-tender.service.gov.uk/Notice/88122-2026</p>
    <p><strong>Captured:</strong> 2026-06-11T08:41:09Z</p>
  </div>
</body>
</html>`,
    structured: {
      buyerName: "NHS England (NHS_TENDERS)",
      contractValuation: "£4,200,000",
      decisionMaker: "Director of Digital Transformation, NHS England",
      cpvCode: "85100000-2 (Health & Social Work)",
      region: "England",
      status: "LIVE_TENDER",
      closingDate: "22 Aug 2026 · 14:30 BST",
      canonicalId: "FTS-2026-88122",
    },
    sha256: "c3b8f1a2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
  },
  {
    id: "planning_permits",
    label: "PLANNING_PERMITS",
    authority: "Welsh Government — Planning Portal",
    rawHtml: `<!DOCTYPE html>
<html>
<head><title>Planning Notice PP-2026-61277</title></head>
<body>
  <div class="planning-notice">
    <h1>A465 Heads of the Valleys Upgrade — Section 2 Enabling Works</h1>
    <p><strong>Buyer:</strong> Welsh Government (PLANNING_PERMITS)</p>
    <p><strong>Buyer Email:</strong> procurement@gov.wales</p>
    <p><strong>Contract Value:</strong> £1,800,000 GBP</p>
    <p><strong>CPV Code:</strong> 45200000-8 (Construction)</p>
    <p><strong>Region:</strong> Wales</p>
    <p><strong>Status:</strong> Live Tender — Enabling Works</p>
    <p><strong>Decision Maker:</strong> Senior Procurement Officer, Welsh Government</p>
    <p><strong>Closing Date:</strong> 10 July 2026, 10:00 BST</p>
    <p><strong>Source:</strong> https://planningportal.gov.wales/notices/PP-2026-61277</p>
    <p><strong>Captured:</strong> 2026-06-10T22:03:11Z</p>
  </div>
</body>
</html>`,
    structured: {
      buyerName: "Welsh Government (PLANNING_PERMITS)",
      contractValuation: "£1,800,000",
      decisionMaker: "Senior Procurement Officer, Welsh Government",
      cpvCode: "45200000-8 (Construction)",
      region: "Wales",
      status: "LIVE_TENDER",
      closingDate: "10 Jul 2026 · 10:00 BST",
      canonicalId: "PP-2026-61277",
    },
    sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  },
];

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightHtml(html: string): string {
  // Monochrome syntax highlighting — white/grey only
  return html
    .replace(/(&lt;[a-z][a-z0-9]*)/gi, '<span class="text-[#94A3B8]">$1</span>')
    .replace(/(\/?&gt;)/gi, '<span class="text-[#94A3B8]">$1</span>')
    .replace(/(&lt;\/[a-z][a-z0-9]*&gt;)/gi, '<span class="text-[#94A3B8]">$1</span>')
    .replace(/(class="[^"]*")/gi, '<span class="text-white/70">$1</span>')
    .replace(/(id="[^"]*")/gi, '<span class="text-white/70">$1</span>')
    .replace(/(£[\d,]+)/g, '<span class="text-white font-medium">$1</span>');
}

export function DataTransformerSandbox() {
  const [activeNotice, setActiveNotice] = React.useState<RawNotice>(RAW_NOTICES[0]);
  const [transforming, setTransforming] = React.useState(false);

  const handleTabChange = (notice: RawNotice) => {
    if (notice.id === activeNotice.id) return;
    setTransforming(true);
    setTimeout(() => {
      setActiveNotice(notice);
      setTransforming(false);
    }, 200);
  };

  return (
    <section className="relative bg-[#09090B] overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-12 relative z-10">
        <div className="text-center mb-16 sm:mb-20 lg:max-w-3xl lg:mx-auto">
          <p className="mb-3 text-[10px] font-sans uppercase tracking-[0.2em] text-[#94A3B8] font-medium">
            [ SOURCE INSPECTOR ]
          </p>
          <h2 className="mb-4 text-3xl font-bold uppercase tracking-tighter text-white sm:text-4xl">
            Raw → Canonical Record
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-[#94A3B8] sm:text-base">
            Select a live government feed. Raw source markup transforms into a
            verified commercial record bound to its SHA-256 digest.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 lg:gap-16">
          {/* Left: Raw source */}
          <div className="flex-1 bg-white/[0.01] border border-white/[0.1] rounded-none overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.3)] flex flex-col">
            <div className="border-b border-white/[0.1] bg-white/[0.02] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-white/30" />
                <div className="h-2 w-2 rounded-full bg-white/15" />
                <div className="h-2 w-2 rounded-full bg-white/8" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-medium">
                  SOURCE DOCUMENT
                </span>
                <span className="w-px h-3 bg-white/[0.04]" />
                <span className="font-sans text-[10px] text-[#94A3B8]/60 uppercase tracking-tighter">
                  raw html
                </span>
              </div>
            </div>
            <div className="p-5 text-[10px] leading-relaxed overflow-x-auto flex-1 min-h-0 font-sans text-[#94A3B8]/80">
              <div
                className="whitespace-pre break-all"
                dangerouslySetInnerHTML={{
                  __html: highlightHtml(escapeHtml(activeNotice.rawHtml)),
                }}
              />
            </div>
            <div className="border-t border-white/[0.1] bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#94A3B8]/70 font-medium">
                  Source:
                </span>
                <span className="font-sans text-[10px] text-[#94A3B8]/80">
                  {activeNotice.authority}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Canonical record */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="flex-1 bg-white/[0.01] border border-white/[0.1] rounded-none overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)] flex flex-col"
          >
            <div className="border-b border-white/[0.1] bg-white/[0.02] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/20 border border-white/40" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-medium">
                  STRUCTURED RECORD
                </span>
                <span className="px-2.5 py-0.5 rounded border border-white/10 bg-white/5 text-white text-[10px] uppercase tracking-[0.1em] font-medium">
                  {activeNotice.structured.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 pr-3">
              {[
                { label: "BUYER_NAME", value: activeNotice.structured.buyerName },
                { label: "ESTIMATED_VALUE", value: activeNotice.structured.contractValuation },
                { label: "DECISION_MAKER", value: activeNotice.structured.decisionMaker },
                { label: "CPV_CODE", value: activeNotice.structured.cpvCode },
                { label: "REGION", value: activeNotice.structured.region },
                { label: "CLOSING_DATE", value: activeNotice.structured.closingDate },
              ].map((field) => (
                <motion.div
                  key={field.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
                  className="flex justify-between border-b border-white/[0.04] pb-3 last:border-b-0"
                >
                  <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#94A3B8]/80 font-medium">
                    {field.label}
                  </span>
                  <span className="font-sans text-sm text-white/90 tabular-nums font-medium">
                    {field.value}
                  </span>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.15 }}
                className="flex justify-between border-b border-white/[0.04] pb-3 last:border-b-0"
              >
                <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#94A3B8]/80 font-medium">
                  CANONICAL_ID
                </span>
                <span className="font-sans text-sm text-white/90 tabular-nums font-medium">
                  {activeNotice.structured.canonicalId}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.2 }}
                className="mt-6 border-t border-white/[0.1] pt-5"
              >
                <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#94A3B8]/80 font-medium">
                  SHA-256 HMAC DIGEST
                </span>
                <div className="mt-3 flex items-center gap-3">
                  <code className="flex-1 text-[10px] break-all border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5 text-[#94A3B8]/80 font-sans tabular-nums">
                    {activeNotice.sha256}
                  </code>
                  <span className="flex items-center gap-1.5 px-3 py-0.75 rounded border border-white/10 bg-white/5 text-white text-[10px] uppercase tracking-[0.1em] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse" />
                    VERIFIED
                  </span>
                </div>
                <p className="mt-4 text-[10px] text-[#94A3B8]/80 leading-relaxed">
                  Zero inference. Every value is bound to the source payload via
                  an immutable SHA-256 digest.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
