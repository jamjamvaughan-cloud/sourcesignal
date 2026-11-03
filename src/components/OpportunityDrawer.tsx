"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Clock,
  FileText,
  Hash,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildTimeline,
  capabilityBadges,
  commercialWhy,
  daysUntil,
  formatDate,
  formatSpend,
  opportunityTypeLabel,
  regionLabel,
  sectorLabel,
  signalScore,
  type SignalRecord,
  type TimelineState,
} from "@/lib/signal-view";

const TIMELINE_DOT: Record<TimelineState, string> = {
  complete: "bg-white/40",
  active: "bg-[#D4AF37]",
  upcoming: "border border-white/30 bg-[#050505]",
};

interface OpportunityDrawerProps {
  opportunity: SignalRecord | null;
  open: boolean;
  onClose: () => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 px-3 py-2.5">
      <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </p>
      <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-100">
        {children}
      </div>
    </div>
  );
}

function CopyButton({ hash }: { hash: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; best effort.
    }
  };

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy SHA-256 hash"}
      onClick={handleCopy}
      className="flex-shrink-0 border border-white/10 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors hover:border-white/35 hover:text-white"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function OpportunityDrawer({
  opportunity,
  open,
  onClose,
}: OpportunityDrawerProps) {
  if (!opportunity) return null;

  const score = signalScore(opportunity);
  const spend = formatSpend(
    opportunity.estimated_value ?? opportunity.est_deal_value,
    opportunity.currency,
  );
  const closing = daysUntil(opportunity.closing_date);
  const badges = capabilityBadges(opportunity);
  const timeline = buildTimeline(opportunity);
  const sha256 =
    opportunity.sha256_hash?.trim() ||
    opportunity.source_hash?.trim() ||
    "";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l border-white/10 bg-[#050505] p-0 text-white data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]"
      >
        <div className="flex h-full flex-col">
          <SheetClose
            render={
              <button
                type="button"
                aria-label="Close audit drawer"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center border border-white/15 bg-[#050505] text-zinc-400 transition-colors hover:border-white/40 hover:text-white"
              />
            }
          >
            <X className="h-4 w-4" />
          </SheetClose>

          <SheetHeader className="border-b border-white/10 px-4 py-5 pr-14 sm:px-6">
            <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-500">
              {sectorLabel(opportunity.sector)} ·{" "}
              {regionLabel(opportunity.region)} ·{" "}
              {opportunityTypeLabel(opportunity.opportunity_type)}
            </p>
            <SheetTitle className="mt-3 font-mono text-xl font-bold uppercase leading-tight tracking-tight text-white">
              {opportunity.buyer?.trim() || opportunity.title}
            </SheetTitle>
            <SheetDescription className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-zinc-500">
              {opportunity.title}
              <span className="mt-1 block text-[9px] text-zinc-600">
                REF {opportunity.canonical_id}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
            {/* Core metrics */}
            <div className="grid grid-cols-3 gap-px bg-white/10">
              <div className="bg-[#050505] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                  Signal score
                </p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white">
                  {score}
                </p>
              </div>
              <div className="bg-[#050505] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                  Est. spend
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-white">
                  {spend}
                </p>
              </div>
              <div className="bg-[#050505] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                  Closes
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-white">
                  {closing == null
                    ? "—"
                    : closing >= 0
                      ? `${closing}D`
                      : "CLOSED"}
                </p>
              </div>
            </div>

            {/* Commercial why */}
            <section>
              <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-500">
                Commercial why
              </p>
              <p className="mt-2 border-l border-[#D4AF37] pl-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                {commercialWhy(opportunity)}
              </p>
            </section>

            {/* Capability requirements */}
            <section>
              <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-500">
                Capability requirements
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="border border-white/10 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-zinc-300"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </section>

            {/* Cryptographic Provenance & Audit Trail */}
            <section className="border border-white/10">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
                <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-[#D4AF37]">
                  Verified Primary Artifact [SHA-256 Secure]
                </p>
              </div>
              <div className="space-y-3 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                      Signal SHA-256 hash
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 block break-all border border-white/5 bg-white/[0.02] px-2 py-1.5 font-mono text-[9px] leading-relaxed text-zinc-400">
                        {sha256 || "AWAITING SOURCE CAPTURE"}
                      </code>
                      <CopyButton hash={sha256} />
                    </div>
                  </div>
                  {sha256 ? (
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-500">
                      Unverified
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Raw payload">
                    {sha256 ? "Captured (JSONB)" : "Not captured"}
                  </Field>
                  <Field label="Audit snapshot">
                    {sha256 ? "Immutable HTML" : "—"}
                  </Field>
                </div>
                <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-zinc-500">
                  The SHA-256 digest is computed over the canonical raw
                  adapter payload and stored immutably. Any change to the
                  source data produces a different digest.
                </p>
              </div>
            </section>

            {/* Source provenance */}
            <section className="border border-white/10">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
                <Hash className="h-3.5 w-3.5 text-[#D4AF37]" />
                <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-400">
                  Source provenance
                </p>
              </div>
              <div className="space-y-3 px-3 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Source">
                    {opportunity.source_name?.trim() || "Primary source"}
                  </Field>
                  <Field label="Captured">
                    {formatDate(
                      opportunity.source_captured_at ?? opportunity.created_at,
                    )}
                  </Field>
                </div>
                {opportunity.source_url ? (
                  <a
                    href={opportunity.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-between border border-white/15 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white transition-colors hover:border-white/40 hover:bg-white/5"
                  >
                    Open source document
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                    Source link not attached
                  </p>
                )}
              </div>
            </section>

            {/* Incumbent position */}
            <section className="border border-white/10">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
                <TriangleAlert className="h-3.5 w-3.5 text-[#D4AF37]" />
                <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-400">
                  Incumbent position
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/10">
                <div className="bg-[#050505] p-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                    Current holder
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-200">
                    {opportunity.winner?.trim() || "Not disclosed"}
                  </p>
                </div>
                <div className="bg-[#050505] p-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                    Displacement trigger
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-200">
                    {opportunity.vulnerability_trigger?.trim() || "Open window"}
                  </p>
                </div>
              </div>
            </section>

            {/* Incumbent / contract timeline */}
            <section>
              <p className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-500">
                <Clock className="h-3.5 w-3.5" /> Incumbent timeline
              </p>
              {timeline.length === 0 ? (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                  No dated milestones captured
                </p>
              ) : (
                <ol className="mt-3 space-y-0">
                  {timeline.map((entry, index) => (
                    <li key={`${entry.label}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < timeline.length - 1 && (
                        <span className="absolute left-[3px] top-2.5 h-full w-px bg-white/10" />
                      )}
                      <span
                        className={`mt-1 h-[7px] w-[7px] flex-shrink-0 ${TIMELINE_DOT[entry.state]}`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                            {entry.label}
                          </p>
                          <p className="font-mono text-[9px] tabular-nums text-white">
                            {entry.value}
                          </p>
                        </div>
                        {entry.note && (
                          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-zinc-600">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-6">
            <span className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
              <FileText className="h-3.5 w-3.5" />
              Source-verified evidence
            </span>
            {opportunity.source_url ? (
              <a
                href={opportunity.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-black transition-colors hover:bg-[#D4AF37]"
              >
                View evidence
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-600">
                No source attached
              </span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
