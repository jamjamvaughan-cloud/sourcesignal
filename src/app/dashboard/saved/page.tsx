import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { backendJson } from "@/lib/backend";

interface SavedOpportunity {
  id: string;
  title: string;
  buyer: string | null;
  sector: string;
  region: string;
  estimated_value: number | null;
  currency: string | null;
  saved_at: string;
}

const MAX_SAVED = 50;

function formatCurrency(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const code = (currency || "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("en-GB")} ${code}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface SavedOpportunitiesResponse {
  items?: Array<{
    id: string;
    savedAt: string;
    opportunity?: {
      title?: string | null;
      buyer?: string | null;
      sector?: string | null;
      region?: string | null;
      estimated_value?: number | null;
      currency?: string | null;
    };
  }>;
}

async function fetchSavedOpportunities(): Promise<SavedOpportunity[]> {
  const result = await backendJson<SavedOpportunitiesResponse>(
    "/api/saved-opportunities",
  );

  return (result?.items ?? []).slice(0, MAX_SAVED).map((item) => ({
    id: item.id,
    title: item.opportunity?.title ?? "Untitled opportunity",
    buyer: item.opportunity?.buyer ?? null,
    sector: item.opportunity?.sector ?? "",
    region: item.opportunity?.region ?? "",
    estimated_value:
      item.opportunity?.estimated_value != null
        ? Number(item.opportunity.estimated_value)
        : null,
    currency: item.opportunity?.currency ?? null,
    saved_at: new Date(item.savedAt).toISOString(),
  }));
}

export default async function SavedPage() {
  const saved = await fetchSavedOpportunities();

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
        <div>
          <h1 className="headline mb-0.5">Saved Tenders</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Shortlisted contracts ready for review and pursuit.</p>
        </div>
        <div className="flex gap-1">
          {/* CSV export is gated server-side to Pro accounts. */}
          <Button variant="ghost" className="px-4 py-2 text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out rounded-sm">
            Export CSV
          </Button>
          <Button variant="ghost" className="px-4 py-2 text-[10px] font-inter font-semibold text-slate-400 border border-white/10 hover:bg-white/5 transition-all duration-200 ease-out rounded-sm">
            Export PDF
          </Button>
        </div>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          title="No saved tenders"
          description="You haven't saved any tenders yet. Browse the tender pipeline and save opportunities you want to track."
        />
      ) : (
        <div className="glass-card overflow-hidden max-w-full min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-[#0F0F11]">
                <tr className="border-b border-white/5 sticky top-0 z-10">
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Tender Title</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Buyer</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Sector</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Region</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right">CapEx Value</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500">Saved</th>
                  <th className="px-4 py-3 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {saved.map((opp) => (
                  <tr key={opp.id} className="table-row">
                    <td className="px-4 py-4 text-sm font-inter font-semibold text-[#E5E5EA]">{opp.title}</td>
                    <td className="px-4 py-4 text-sm font-inter font-mono text-slate-400 tabular-nums">{opp.buyer ?? "—"}</td>
                    <td className="px-4 py-4 text-sm font-inter text-slate-400">{opp.sector}</td>
                    <td className="px-4 py-4 text-sm font-inter font-mono text-slate-400 tabular-nums">{opp.region}</td>
                    <td className="px-4 py-4 text-right"><span className="text-sm font-inter font-bold text-[#E5E5EA] font-mono tabular-nums">{formatCurrency(opp.estimated_value, opp.currency)}</span></td>
                    <td className="px-4 py-4 text-sm font-inter font-mono text-slate-400 tabular-nums">{formatDate(opp.saved_at)}</td>
                    <td className="px-4 py-4 text-right">
                      <ChevronRight className="h-4 w-4 text-slate-600 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
