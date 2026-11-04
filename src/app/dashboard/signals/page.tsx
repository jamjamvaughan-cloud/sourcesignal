import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Target } from "lucide-react";
import { backendJson, getSessionContext } from "@/lib/backend";
import {
  formatDate,
  formatSpend,
  estimatedSpend,
  sectorLabel,
  type SignalRecord,
} from "@/lib/signal-view";

export const metadata: Metadata = {
  title: "Signals | SourceSignal",
  description:
    "Primary-source commercial signals, captured directly from official registries.",
};

interface SignalsResponse {
  items?: SignalRecord[];
  total?: number;
  isPro?: boolean;
}

const JURISDICTION_LABELS: Record<string, string> = {
  UK: "United Kingdom",
  US: "United States",
  EU: "European Union",
};

export default async function SignalsPage() {
  const { user, planId } = await getSessionContext();
  const isPro = planId === "pro";

  const params = new URLSearchParams({ page: "1", perPage: "100" });
  if (user?.country) params.set("region", user.country);

  const result = await backendJson<SignalsResponse>(
    `/api/signals?${params.toString()}`,
  );
  const signals = result?.items ?? [];
  const total = result?.total ?? signals.length;

  return (
    <div className="space-y-8">
      <header className="border-b border-white/10 pb-6">
        <p className="font-mono text-[8px] uppercase tracking-[0.35em] text-zinc-500">
          SourceSignal // Primary sources
        </p>
        <h1 className="mt-2 font-mono text-2xl font-bold uppercase tracking-tight text-white">
          Signals
        </h1>
        <p className="mt-2 max-w-2xl font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] text-zinc-500">
          {isPro
            ? "Real-time signals, delivered without delay."
            : "Historical signals from your signup jurisdiction. New signals are released after a 24-hour delay."}
          {user?.country
            ? ` Jurisdiction: ${JURISDICTION_LABELS[user.country] ?? user.country}.`
            : ""}
        </p>
      </header>

      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-zinc-500">
          Verified primary-source capture
        </p>
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
          {total.toLocaleString()} signal{total === 1 ? "" : "s"}
        </p>
      </div>

      {signals.length === 0 ? (
        <section className="border border-white/10 bg-[#050505] px-6 py-16 text-center">
          <Target className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            No signals available for your jurisdiction yet
          </p>
          <p className="mt-2 font-mono text-[9px] text-zinc-600">
            New primary-source signals are ingested continuously.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {signals.map((signal) => {
            const spend = formatSpend(
              estimatedSpend(signal),
              signal.currency,
            );
            return (
              <Link
                key={signal.id}
                href={`/dashboard/signals/${encodeURIComponent(signal.id)}`}
                className="group border border-white/10 bg-[#050505] p-5 transition-colors hover:border-white/35 hover:bg-[#080808]"
              >
                <div className="flex items-center justify-between gap-3 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-white/10 bg-white/5 px-1.5 py-0.5 text-[#D4AF37]">
                      [{signal.region ?? "—"}]
                    </span>
                    <span className="border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-400">
                      [{signal.source_name ?? "SOURCE"}]
                    </span>
                    <span>{sectorLabel(signal.sector)}</span>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-700 transition-colors group-hover:text-[#D4AF37]" />
                </div>

                <h2 className="mt-3 line-clamp-2 font-mono text-base font-bold uppercase tracking-tight text-white">
                  {signal.title}
                </h2>
                <p className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed text-zinc-500">
                  {signal.buyer ?? "Buyer not disclosed"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-px bg-white/10">
                  <div className="bg-[#050505] py-2 pr-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600">
                      Est. spend
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
                      {spend === "UNDISCLOSED" ? "—" : spend}
                    </p>
                  </div>
                  <div className="bg-[#050505] py-2 pl-3 text-right">
                    <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600">
                      Published
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
                      {formatDate(signal.published_date)}
                    </p>
                  </div>
                </div>

                {!isPro && (
                  <p className="mt-3 border-l border-[#D4AF37] pl-3 font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-500">
                    Telemetry locked — upgrade to Pro for valuation and commercial rationale.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
