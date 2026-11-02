"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

/* ============================================================================
   SOURCE SIGNAL — SCROLL-DRIVEN LANDING CANVAS
   Scroll-driven camera engine. Four acts, one locked viewport.
   ========================================================================== */

const REGION_SOURCES = [
  {
    code: "UK_MOD_DSP",
    region: "UK",
    authority: "Ministry of Defence",
    latency: "200MS",
    detail:
      "Active defence and infrastructure opportunities from the UK MOD feed.",
  },
  {
    code: "UK_FTS",
    region: "UK",
    authority: "Find a Tender",
    latency: "180MS",
    detail:
      "UK-wide above-threshold notices from the Find a Tender service.",
  },
  {
    code: "UK_CF",
    region: "UK",
    authority: "Contracts Finder",
    latency: "240MS",
    detail:
      "Lower-value and below-threshold UK public sector contracts.",
  },
  {
    code: "SCT_PCS",
    region: "SCT",
    authority: "Public Contracts Scotland",
    latency: "260MS",
    detail:
      "Scottish public sector contract notices and award records.",
  },
  {
    code: "SCT_PCS_TENDER",
    region: "SCT",
    authority: "PCS Tenders",
    latency: "280MS",
    detail:
      "Live Scottish tender opportunities and buyer documentation.",
  },
  {
    code: "SCT_SCOTTISH_WATER",
    region: "SCT",
    authority: "Scottish Water",
    latency: "300MS",
    detail:
      "Scottish Water procurement notices and supplier opportunities.",
  },
  {
    code: "IE_ETENDERS",
    region: "IE",
    authority: "eTenders Ireland",
    latency: "300MS",
    detail:
      "Irish public sector tenders from the national eTenders platform.",
  },
  {
    code: "IE_TED",
    region: "IE",
    authority: "Tenders Electronic Daily",
    latency: "320MS",
    detail:
      "Irish notices published through the EU TED supplement.",
  },
  {
    code: "IE_IRISH_WATER",
    region: "IE",
    authority: "Irish Water",
    latency: "340MS",
    detail:
      "Utility and infrastructure procurement from Irish Water.",
  },
  {
    code: "US_SAM_GOV",
    region: "US",
    authority: "SAM.gov",
    latency: "360MS",
    detail:
      "Federal contract opportunities and entity registration data.",
  },
  {
    code: "US_SAM_OPPS",
    region: "US",
    authority: "SAM.gov Opportunities",
    latency: "380MS",
    detail:
      "Federal opportunity notices with source-linked attachments.",
  },
  {
    code: "US_CAL_EPROCURE",
    region: "US",
    authority: "Cal eProcure",
    latency: "400MS",
    detail:
      "California state procurement opportunities and bid events.",
  },
  {
    code: "CA_BUYS",
    region: "CA",
    authority: "CanadaBuys",
    latency: "420MS",
    detail:
      "Canadian federal tender notices and award information.",
  },
  {
    code: "CA_PROACTIVE",
    region: "CA",
    authority: "Proactive Disclosure",
    latency: "440MS",
    detail:
      "Published Canadian federal contract award disclosures.",
  },
  {
    code: "CA_BC_BID",
    region: "CA",
    authority: "BC Bid",
    latency: "460MS",
    detail:
      "British Columbia public sector opportunities and results.",
  },
];

const EXTRACTION_FIELDS = [
  {
    label: "BUYER_EMAIL",
    value: "procurement@mod.gov.uk",
    seal: "SHA-256 HMAC VERIFIED",
  },
  {
    label: "VALUATION",
    value: "£14,200,000",
    seal: "OGL V3.0 MATCH",
  },
  {
    label: "CPV_CODE",
    value: "72000000-5 (IT Services)",
    seal: "AUDIT TRAIL LOCKED",
  },
];

const WORKSPACE_METRICS = [
  { label: "LIVE OPPORTUNITIES", value: "2,481" },
  { label: "REGIONAL FEEDS", value: "15" },
  { label: "MEDIAN VALUE", value: "£412K" },
  { label: "SOURCE MATCH", value: "96.4%" },
];

const HOTKEYS = [
  { key: "/", label: "SEARCH" },
  { key: "J / K", label: "NAVIGATE" },
  { key: "S", label: "SAVE OPPORTUNITY" },
];

/**
 * True below the Tailwind `md` breakpoint (768px). Used to swap heavy 3D
 * camera transforms for cheap 2D opacity/translate motion on touch devices.
 */
export default function Home() {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  /* --------------------------------------------------------------------------
     ACT I — Hero (0% → 25%)
     ------------------------------------------------------------------------ */
  const act1Opacity = useTransform(scrollYProgress, [0, 0.18, 0.27], [1, 1, 0]);
  const act1Scale = useTransform(scrollYProgress, [0, 0.25], [1, 0.9]);
  const act1Y = useTransform(scrollYProgress, [0, 0.25], [0, -24]);

  /* --------------------------------------------------------------------------
     ACT II — 15 regional sources (26% → 50%)
     ------------------------------------------------------------------------ */
  const act2Opacity = useTransform(
    scrollYProgress,
    [0.24, 0.29, 0.46, 0.52],
    [0, 1, 1, 0]
  );
  const act2Scale = useTransform(
    scrollYProgress,
    [0.24, 0.44, 0.5],
    [0.95, 1, 1]
  );
  const act2Y = useTransform(scrollYProgress, [0.24, 0.5], [12, -12]);

  /* --------------------------------------------------------------------------
     ACT III — Structured extraction & provenance (51% → 75%)
     ------------------------------------------------------------------------ */
  const act3Opacity = useTransform(
    scrollYProgress,
    [0.48, 0.54, 0.7, 0.76],
    [0, 1, 1, 0]
  );
  const act3Scale = useTransform(
    scrollYProgress,
    [0.5, 0.63, 0.75],
    [0.97, 0.98, 1]
  );
  const act3Y = useTransform(scrollYProgress, [0.48, 0.76], [12, -12]);

  /* --------------------------------------------------------------------------
     ACT IV — Live workspace (76% → 100%)
     ------------------------------------------------------------------------ */
  const act4Opacity = useTransform(
    scrollYProgress,
    [0.73, 0.79, 0.95, 1],
    [0, 1, 1, 0.85]
  );
  const act4Scale = useTransform(
    scrollYProgress,
    [0.75, 0.9, 1],
    [0.98, 1.01, 1.01]
  );
  const act4Y = useTransform(scrollYProgress, [0.73, 0.95], [12, -6]);

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-white focus:bg-white focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:text-black"
      >
        Skip to main content
      </a>

      <div id="main-content" className="relative flex-1 bg-black">
        {/* Invisible progress rail: 430vh (mobile) / 540vh (desktop) makes the
            400vh / 500vh pinned track release at scrollYProgress ≈ 0.91. */}
        <div
          ref={scrollRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[430vh] md:h-[540vh]"
        />

        {/* ====================================================================
            PINNED SCROLL TRACK — 500vh
            ================================================================== */}
        <section className="relative min-h-[400vh] w-full bg-black md:h-[500vh] md:min-h-0">
          <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-black perspective-[1200px]">
            {/* Deep-space field */}
            <div className="pointer-events-none absolute inset-0 ambient-grid opacity-70" />
            <div className="pointer-events-none absolute inset-0 radial-glare" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.55)_72%,#000000_100%)]" />

            {/* ================================================================
                ACT I — PROCUREMENT INTELLIGENCE
                ============================================================== */}
            <motion.div
              style={{
                opacity: act1Opacity,
                scale: act1Scale,
                y: act1Y,
                transformStyle: "flat",
              }}
              className="pointer-events-none absolute inset-0 flex transform-gpu flex-col items-center justify-center px-4 text-center will-change-transform transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased sm:px-8 md:px-16"
            >
              <div
                className="relative mb-5 h-28 w-28 shrink-0 sm:mb-10 sm:h-48 sm:w-48"
                style={{
                  transform: "none",
                  transformStyle: "flat",
                }}
              >
                <div
                  className="absolute -inset-6 border border-white/[0.04]"
                  style={{ transform: "none" }}
                />
                <div className="absolute inset-0 border border-white/[0.06]" />
                <div className="absolute inset-[18%] border border-white/10" />
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
                <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/10" />

                {/* Corner ticks */}
                <div className="absolute left-0 top-0 h-3 w-px bg-white/30" />
                <div className="absolute left-0 top-0 h-px w-3 bg-white/30" />
                <div className="absolute right-0 top-0 h-3 w-px bg-white/30" />
                <div className="absolute right-0 top-0 h-px w-3 bg-white/30" />
                <div className="absolute bottom-0 left-0 h-3 w-px bg-white/30" />
                <div className="absolute bottom-0 left-0 h-px w-3 bg-white/30" />
                <div className="absolute bottom-0 right-0 h-3 w-px bg-white/30" />
                <div className="absolute bottom-0 right-0 h-px w-3 bg-white/30" />

                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.55, 1, 0.55] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                  className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 bg-[#FF5500] shadow-[0_0_28px_#FF5500]"
                />
                <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 bg-white" />
              </div>

              <div className="transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased">
                <p className="eyebrow text-[#FF5500]">
                  [ PROCUREMENT INTELLIGENCE ]
                </p>

                <h1 className="mt-5 max-w-5xl text-3xl font-bold uppercase leading-[1.0] tracking-tighter text-white sm:text-5xl md:text-7xl lg:text-8xl">
                  Procurement intelligence,
                  <span className="block">source by source.</span>
                </h1>

                <p className="mt-5 max-w-2xl font-mono text-xs leading-relaxed text-[#A1A1AA] sm:mt-6 sm:text-sm md:text-base">
                  High-frequency contract discovery for contractors and sole
                  traders. Direct public-sector capital flows with
                  zero-hallucination SHA-256 source traceability.
                </p>

                <div className="pointer-events-auto mt-6 flex w-full max-w-md flex-col items-stretch justify-center gap-2 sm:mt-8 sm:flex-row sm:items-center sm:gap-3">
                  <Link
                    href="/create"
                    className="btn-ghost-primary inline-flex items-center justify-center px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    START FREE
                  </Link>
                  <Link
                    href="/auth/signin"
                    className="btn-ghost-hairline inline-flex items-center justify-center px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    LOG IN
                  </Link>
                </div>

                <div className="mt-7 hidden flex-col items-center gap-2 sm:mt-10 sm:flex">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#71717A]">
                    SCROLL
                  </span>
                  <div className="h-10 w-px bg-gradient-to-b from-white/40 to-transparent" />
                </div>
              </div>
            </motion.div>

            {/* ================================================================
                ACT II — 15 REGIONAL SOURCES
                ============================================================== */}
            <motion.div
              style={{
                opacity: act2Opacity,
                scale: act2Scale,
                y: act2Y,
                transformStyle: "flat",
              }}
              className="pointer-events-none absolute inset-0 flex transform-gpu flex-col items-center justify-center px-4 text-center will-change-transform transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased sm:px-8 md:px-16"
            >
              <p className="eyebrow text-[#FF5500]">
                [ 15 REGIONAL SOURCES ]
              </p>

              <h2 className="mt-3 max-w-4xl text-xl font-bold uppercase leading-[0.95] tracking-tighter text-white sm:mt-4 sm:text-4xl lg:text-5xl">
                15 Regional Procurement Feeds
              </h2>

              <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-[#A1A1AA] sm:mt-4 sm:text-sm md:text-base">
                Public procurement feeds resolve into one clear record. Each
                adapter carries its own authority, latency profile, and audit
                trail.
              </p>

              <div className="mt-4 flex w-full max-w-6xl items-center justify-between border-y border-white/10 py-2 font-mono text-[8px] uppercase tracking-[0.18em] text-[#71717A] sm:mt-8 sm:py-2.5 sm:text-[10px]">
                <span>
                  <span className="text-white">15</span> feeds
                </span>
                <span>
                  <span className="text-white">7</span> regions
                </span>
                <span className="flex items-center gap-1.5 text-[#FF5500]">
                  <span className="status-node" />
                  ALL LIVE
                </span>
              </div>

              <div className="mt-2 grid w-full max-w-6xl grid-cols-3 gap-px border border-white/10 bg-white/10 sm:mt-3 lg:grid-cols-5">
                {REGION_SOURCES.map((source) => (
                  <div
                    key={source.code}
                    title={source.detail}
                    className="group flex min-h-[56px] flex-col justify-between bg-black p-2 text-left transition-colors duration-200 hover:bg-white/[0.04] sm:min-h-[78px] sm:p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#71717A] sm:text-[9px]">
                        {source.region}
                      </span>
                      <span className="h-1.5 w-1.5 shrink-0 bg-[#FF5500]" />
                    </div>

                    <p className="mt-1 break-words font-mono text-[9px] font-medium leading-tight tracking-[0.06em] text-white sm:text-[11px]">
                      {source.code}
                    </p>

                    <div className="mt-1 flex items-center justify-between gap-1 border-t border-white/[0.06] pt-1 font-mono text-[7px] uppercase tracking-[0.1em] text-[#71717A] sm:mt-2 sm:pt-1.5 sm:text-[8px]">
                      <span className="hidden truncate sm:inline">
                        {source.authority}
                      </span>
                      <span className="truncate sm:hidden">LIVE</span>
                      <span className="shrink-0 text-white/80">
                        {source.latency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[#71717A] sm:mt-6 sm:gap-y-2">
                <span>UK OGL v3.0</span>
                <span className="text-white/20">/</span>
                <span>IE eTenders</span>
                <span className="text-white/20">/</span>
                <span>US SAM.gov</span>
                <span className="text-white/20">/</span>
                <span>CA CanadaBuys</span>
                <span className="text-white/20">/</span>
                <span>EU TED</span>
              </div>
            </motion.div>

            {/* ================================================================
                ACT III — STRUCTURED EXTRACTION & PROVENANCE
                ============================================================== */}
            <motion.div
              style={{
                opacity: act3Opacity,
                scale: act3Scale,
                y: act3Y,
                transformStyle: "flat",
                transformOrigin: "center center",
              }}
              className="pointer-events-none absolute inset-0 flex transform-gpu flex-col items-center justify-center px-4 text-center will-change-transform transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased sm:px-8 md:px-16"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <div className="absolute inset-0 backdrop-blur-md bg-zinc-950/90" />
              </div>

              <div className="relative z-10 transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased">
                <p className="eyebrow text-[#FF5500]">
                  [ STRUCTURED EXTRACTION ]
                </p>

                <h2 className="mt-4 max-w-4xl text-xl font-bold uppercase leading-[0.95] tracking-tighter text-white sm:text-4xl lg:text-5xl">
                  Raw notice <span className="text-[#FF5500]">&rarr;</span>{" "}
                  canonical record
                </h2>

                <div className="mt-6 w-full max-w-3xl overflow-hidden border border-white/[0.06] bg-white/[0.01] px-3 py-2 text-left font-mono text-[9px] text-[#52525B]">
                  <span className="text-[#71717A]">RAW_NOTICE</span>
                  <span className="mx-2 text-white/15">::</span>
                  2026/S 204-882134
                  <span className="mx-2 text-white/15">::</span>
                  SECTION II.1.1 — SUPPLY OF SECURE NETWORK INFRASTRUCTURE
                </div>

                <div className="mt-4 w-full max-w-3xl border border-white/20 text-left sm:mt-6">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#71717A]">
                      STRUCTURED RECORD
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#FF5500]">
                      <span className="status-node" />
                      VERIFIED
                    </span>
                  </div>

                  {EXTRACTION_FIELDS.map((field) => (
                    <div
                      key={field.label}
                      className="flex flex-col items-start gap-1 border-b border-white/[0.08] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-5 sm:py-4"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#71717A]">
                          {field.label}
                        </p>
                        <p className="mt-1 break-words font-mono text-xs text-white sm:text-sm">
                          {field.value}
                        </p>
                      </div>
                      <span className="w-fit shrink-0 border border-[#FF5500]/40 bg-[#FF5500]/5 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#FF5500]">
                        [ {field.seal} ]
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#71717A] sm:px-5">
                    <span>CANONICAL_HASH</span>
                    <span className="text-white">9f2c7a41e8b3...d04f</span>
                  </div>
                </div>

                <p className="mt-5 max-w-xl font-mono text-xs leading-relaxed text-[#71717A] sm:mt-6 sm:text-sm md:text-base">
                  Zero inference. Every value is evidenced by the source payload
                  or explicitly marked unknown.
                </p>
              </div>
            </motion.div>

            {/* ================================================================
                ACT IV — LIVE WORKSPACE
                ============================================================== */}
            <motion.div
              style={{
                opacity: act4Opacity,
                scale: act4Scale,
                y: act4Y,
                transformStyle: "flat",
              }}
              className="pointer-events-none absolute inset-0 flex transform-gpu flex-col items-center justify-center px-4 text-center will-change-transform transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased sm:px-8 md:px-16"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <div className="absolute inset-0 backdrop-blur-md bg-black/70" />
              </div>

              <div className="relative z-10 transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased">
                <p className="eyebrow text-[#FF5500]">
                  [ LIVE WORKSPACE ]
                </p>

                <h2 className="mt-4 text-3xl font-bold uppercase leading-none tracking-tighter text-white sm:text-5xl lg:text-6xl">
                  Opportunity Workspace
                </h2>

                <p className="mt-4 max-w-xl font-mono text-xs leading-relaxed text-[#A1A1AA] sm:text-sm md:text-base">
                  Search, review, and export every live opportunity from one clean
                  workspace.
                </p>

                <div className="mt-7 w-full max-w-5xl border border-white/10 text-left sm:mt-9">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#A1A1AA]">
                    LIVE OPPORTUNITIES
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#FF5500]">
                    <span className="status-node" />
                    15 FEEDS NOMINAL
                  </span>
                </div>

                <div className="grid grid-cols-2 divide-white/10 sm:grid-cols-4 sm:divide-x">
                  {WORKSPACE_METRICS.map((metric) => (
                    <div
                      key={metric.label}
                      className="border-b border-white/10 px-4 py-3 sm:border-b-0 sm:py-4"
                    >
                      <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#71717A]">
                        {metric.label}
                      </p>
                      <p className="mt-1 font-mono text-lg text-white sm:text-xl">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden border-t border-white/10 sm:block">
                  <div className="flex items-center justify-between px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#71717A]">
                    <span>MOD DSP / 2026/S 204-882134</span>
                    <span className="text-white">£14,200,000</span>
                    <span className="text-[#FF5500]">SHA-256 VERIFIED</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#71717A]">
                    <span>SAM.GOV / 36C10B26R0031</span>
                    <span className="text-white">$8,450,000</span>
                    <span className="text-[#FF5500]">SHA-256 VERIFIED</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3 sm:gap-4">
                  {HOTKEYS.map((hotkey) => (
                    <span
                      key={hotkey.key}
                      className="border border-white/15 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#A1A1AA]"
                    >
                      <span className="text-white">[{hotkey.key}]</span>{" "}
                      {hotkey.label}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ====================================================================
            UNPINNED FINALE — QUESTIONS / ACCESS / LEGAL
            ================================================================== */}
        <section
          id="finale"
          className="relative border-t border-white/10 bg-black"
        >
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8 sm:py-24 md:px-16">
            {/* Questions */}
            <div className="max-w-3xl">
              <p className="eyebrow">[ COMMON QUESTIONS ]</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-bold uppercase leading-[0.95] tracking-tighter text-white sm:text-5xl">
                Questions, answered at source.
              </h2>
            </div>

            <div className="mt-10 border-t border-white/10 sm:mt-12">
              <FaqItem
                q="How is data verified?"
                a="Every notice carries a SHA-256 hash computed from its source URL and raw payload. The hash is recomputed on every re-fetch, and any byte-level change opens a new ingestion cycle."
              />
              <FaqItem
                q="Which regions are covered?"
                a="Fifteen regional adapters across the UK, Ireland, the United States, and Canada — including SAM.gov, Contracts Finder, eTenders, CanadaBuys, and BC Bid."
              />
              <FaqItem
                q="Is there zero-hallucination?"
                a="Yes. Buyer email, contract valuation, closing date, and award status are never inferred. Each value is either evidenced by the source or explicitly marked unknown."
              />
              <FaqItem
                q="What does Pro include?"
                a="Full opportunity details, buyer contact emails, valuation estimates, CSV and JSON exports, alert routing, and the interactive 3D opportunity map."
              />
            </div>

            {/* Final access CTA */}
            <div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-8 sm:mt-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-sm">
                <p className="eyebrow text-[#FF5500]">[ OPEN ACCESS ]</p>
                <p className="mt-3 font-mono text-xs leading-relaxed text-[#A1A1AA] sm:text-sm">
                  Build your opportunity pipeline from live public-sector data.
                  Start free or sign back into your workspace.
                </p>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                <Link
                  href="/create"
                  className="btn-ghost-primary inline-flex items-center justify-center px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
                >
                  START FREE
                </Link>
                <Link
                  href="/auth/signin"
                  className="btn-ghost-hairline inline-flex items-center justify-center px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
                >
                  LOG IN
                </Link>
              </div>
            </div>

            {/* Legal footer */}
            <div className="mt-12 border-t border-white/[0.08] pt-8 sm:mt-16">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-md font-mono text-[9px] leading-relaxed text-[#71717A]">
                  SourceSignal publishes open public-sector procurement data
                  under the{" "}
                  <a
                    href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#A1A1AA] underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
                  >
                    UK Open Government Licence v3.0
                  </a>
                  . Attribution is retained on every record.
                </p>

                <p className="max-w-sm font-mono text-[9px] leading-relaxed text-[#71717A] sm:text-right">
                  No consumer profiles. No data resale. No behavioural
                  advertising. Essential session tokens only.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.06] pt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#52525B] sm:flex-row sm:items-center sm:justify-between">
                <span>SourceSignal — Procurement Intelligence</span>
                <span>Zero-tracking architecture</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-6 py-5 text-left"
      >
        <span className="text-sm font-medium uppercase tracking-[0.02em] text-[#A1A1AA] transition-colors group-hover:text-white">
          {q}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-[#FF5500]">
          {open ? "—" : "+"}
        </span>
      </button>

      {open && (
        <p className="max-w-2xl pb-6 font-mono text-[10px] leading-relaxed text-[#71717A] sm:text-xs">
          {a}
        </p>
      )}
    </div>
  );
}
