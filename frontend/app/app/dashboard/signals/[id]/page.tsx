import type { Metadata } from "next";
import type * as React from "react";
import Link from "next/link";
import { ExternalLink, ChevronRight, Target, Building, Clock, ShieldCheck } from "lucide-react";
import { backendJson, getSessionContext } from "@/lib/backend";
import {
  formatDate,
  formatSpend,
  estimatedSpend,
  sectorLabel,
  type SignalRecord,
} from "@/lib/signal-view";

export const metadata: Metadata = {
  title: "Signal Detail | SourceSignal",
};

interface SignalResponse {
  signal?: SignalRecord;
  isPro?: boolean;
}

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { planId } = await getSessionContext();
  const isPro = planId === "pro";

  const result = await backendJson<SignalResponse>(
    `/api/signals/${encodeURIComponent(id)}`,
  );
  const signal = result?.signal;

  if (!signal) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="border border-white/10 bg-[#050505] p-12 text-center">
          <Target className="mx-auto h-10 w-10 text-zinc-700" />
          <h2 className="mt-4 font-mono text-lg font-bold uppercase text-white">
            Signal not available
          </h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            It may be outside your jurisdiction, embargoed, or no longer retained.
          </p>
          <Link
            href="/dashboard/signals"
            className="mt-6 inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#D4AF37] hover:text-white"
          >
            Back to signals <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  const spend = formatSpend(estimatedSpend(signal), signal.currency);

  return (
    <div className="max-w-5xl space-y-8">
      <header className="border-b border-white/10 pb-6">
        <Link
          href="/dashboard/signals"
          className="mb-3 inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 hover:text-white"
        >
          <ChevronRight className="h-3 w-3 rotate-180" /> Back to signals
        </Link>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
          <span className="border border-white/10 bg-white/5 px-1.5 py-0.5 text-[#D4AF37]">
            [{signal.region ?? "—"}]
          </span>
          <span className="border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-400">
            [{signal.source_name ?? "SOURCE"}]
          </span>
          <span>{sectorLabel(signal.sector)}</span>
          {signal.opportunity_type && <span>· {signal.opportunity_type}</span>}
        </div>
        <h1 className="mt-3 font-mono text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
          {signal.title}
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          {signal.buyer ?? "Buyer not disclosed"}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Est. spend"
          value={spend === "UNDISCLOSED" ? "—" : spend}
          note={isPro ? "Primary-source valuation" : "Pro only"}
        />
        <MetricCard
          label="Published"
          value={formatDate(signal.published_date)}
          note="Source publication date"
        />
        <MetricCard
          label="Captured"
          value={formatDate(signal.source_captured_at ?? signal.created_at)}
          note="Ingestion timestamp"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Commercial rationale" icon={ShieldCheck}>
          {isPro && signal.commercial_why ? (
            <p className="font-mono text-[11px] leading-relaxed text-zinc-300">
              {signal.commercial_why}
            </p>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Locked — upgrade to Pro to view the commercial rationale.
            </p>
          )}
        </Section>

        <Section title="Provenance" icon={Building}>
          <dl className="space-y-2 font-mono text-[10px] text-zinc-400">
            <Row label="Source" value={signal.source_name ?? "—"} />
            <Row label="Jurisdiction" value={signal.region ?? "—"} />
            <Row label="Type" value={signal.opportunity_type ?? "—"} />
            <Row label="Source hash" value={signal.source_hash ?? "—"} truncate />
            <Row label="SHA-256" value={signal.sha256_hash ?? "Pending backfill"} truncate />
          </dl>
        </Section>
      </div>

      <Section title="Source notice" icon={ExternalLink}>
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-zinc-400">
          Captured directly from {signal.source_name ?? "the primary source"}.
          The full notice and supporting documentation are available at the
          official source URL below.
        </p>
        {signal.source_url ? (
          <a
            href={signal.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#D4AF37] underline underline-offset-4 hover:text-white"
          >
            Open source notice <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-600">
            Source URL unavailable
          </span>
        )}
      </Section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border border-white/10 bg-[#050505] p-5">
      <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-zinc-600">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-bold tabular-nums text-white">
        {value}
      </p>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-600">
        {note}
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-white/10 bg-[#050505] p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#D4AF37]" />
        <h2 className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="flex-shrink-0 uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </dt>
      <dd className={`text-right text-zinc-300 ${truncate ? "truncate font-mono text-[9px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
