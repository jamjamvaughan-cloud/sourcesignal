"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Layers,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";

export interface InspectorData {
  id: string;
  canonical_id: string;
  title: string;
  sector: string;
  region: string;
  country: string;
  buyer: string;
  predicted_value: number;
  currency: string;
  confidence: number;
  signal_tier: string;
  source_url: string;
  source_name: string;
  source_captured_at?: string | null;
  source_hash?: string | null;
  summary?: string | null;
  displacement_probability?: number;
  primary_driver?: string;
  vulnerability_trigger?: string | null;
  displacement_reasons: string[];
  tech_stack: Array<{
    name: string;
    category: string;
    maturity: "legacy" | "modern" | "transitioning";
  }>;
  intent_signals: Array<{
    name: string;
    value: string;
    severity: "high" | "medium" | "low";
  }>;
}

const MATURITY_STYLES: Record<string, string> = {
  legacy: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  modern: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  transitioning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

const TIER_COLORS: Record<string, string> = {
  MEGAPROCUREMENT: "D4AF37",
  HIGH_CAP: "D4AF37",
  STANDARD_COMMERCIAL: "E5E5EA",
};

function getVulnerabilityStyle(trigger: string): string {
  const styles: Record<string, string> = {
    "Legacy System EOL": "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    "Vendor Price Surge": "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    "CAPEX Expansion": "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    "Planning Approval Stage 2": "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  };
  return styles[trigger] || "bg-slate-500/10 text-slate-400 border border-slate-500/20";
}

interface InspectorSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function InspectorSection({
  title,
  icon: Icon,
  children,
}: InspectorSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-D4AF37" />
        <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface InspectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspector: InspectorData | null;
}

export function InspectorDrawer({
  open,
  onOpenChange,
  inspector,
}: InspectorDrawerProps) {
  if (!inspector) return null;

  const tierColor = TIER_COLORS[inspector.signal_tier ?? ""] || "E5E5EA";
  const dealTier =
    inspector.predicted_value >= 50_000_000
      ? "MEGA"
      : inspector.predicted_value >= 5_000_000
        ? "LARGE"
        : inspector.predicted_value >= 500_000
          ? "MEDIUM"
          : "SMALL";
  const dealTierStyles: Record<string, string> = {
    SMALL: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    LARGE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    MEGA: "bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger>
        <button className="inline-flex items-center justify-center w-full h-full" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full lg:w-[620px] border border-white/10 bg-[#09090b]/90 backdrop-blur-md max-h-[95vh]">
        <SheetHeader className="pb-4 border-b border-white/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <InspectorBadge tier={inspector.signal_tier ?? "STANDARD_COMMERCIAL"} color={tierColor} />
              <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${dealTierStyles[dealTier]}`}>
                {dealTier}
              </span>
              {inspector.vulnerability_trigger && (
                <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${getVulnerabilityStyle(inspector.vulnerability_trigger)}`}>
                  {inspector.vulnerability_trigger}
                </span>
              )}
              {(inspector.source_hash || inspector.summary) && (
                <span className="flex items-center gap-1 px-2 py-1 border border-D4AF37/30 bg-D4AF37/5 rounded text-[9px] font-inter font-bold text-D4AF37 uppercase tracking-tighter">
                  Signal Verified & Timestamped
                </span>
              )}
            </div>
            <SheetTitle className="text-xl font-inter font-bold text-white tracking-tight">
              {inspector.title}
            </SheetTitle>
            <SheetDescription className="text-[10px] font-inter font-mono tracking-wider text-slate-500 mt-1">
              Reference: {inspector.canonical_id}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="divide-y divide-white/5 p-4 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Scraped Source Metadata */}
          <InspectorSection title="Scraped Source Metadata" icon={Layers}>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-sm font-inter text-slate-300">Source Name</span>
                <span className="text-sm font-inter font-mono text-D4AF37">{inspector.source_name}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-sm font-inter text-slate-300">Source URL</span>
                <a
                  href={inspector.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-inter font-medium text-D4AF37 hover:text-D4AF37/80 transition-colors underline underline-offset-4"
                >
                  Open Source ↗
                </a>
              </div>
              {inspector.source_captured_at && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-sm font-inter text-slate-300">Captured At</span>
                  <span className="text-sm font-inter font-mono text-slate-400 tabular-nums">
                    {new Date(inspector.source_captured_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </InspectorSection>

          {/* Intent Metrics */}
          <InspectorSection title="Intent Metrics" icon={Target}>
            {inspector.intent_signals.length > 0 ? (
              <div className="space-y-2">
                {inspector.intent_signals.map((sig) => (
                  <div key={sig.name} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-inter text-slate-300">{sig.name}</span>
                    </div>
                    <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${SEVERITY_STYLES[sig.severity]}`}>
                      {sig.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-inter text-slate-500">No intent signals detected.</p>
            )}
          </InspectorSection>

          {/* Commercial Intent / Grievance Summary */}
          <InspectorSection title="Commercial Intent & Grievance Summary" icon={AlertTriangle}>
            {inspector.primary_driver ? (
              <p className="text-sm font-inter text-slate-300 leading-relaxed">
                {inspector.primary_driver}
              </p>
            ) : (
              <p className="text-sm font-inter text-slate-500">No intent summary available.</p>
            )}
          </InspectorSection>

          {/* Displacement Reasons */}
          <InspectorSection title="Verified Displacement Reasons" icon={AlertTriangle}>
            {inspector.displacement_reasons.length > 0 ? (
              <ul className="space-y-2 pl-4 list-disc text-sm font-inter text-slate-300">
                {inspector.displacement_reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-inter text-slate-500">No verified displacement reasons on file.</p>
            )}
          </InspectorSection>

          {/* Tech Stack */}
          <InspectorSection title="Current Tech Stack" icon={Layers}>
            {inspector.tech_stack.length > 0 ? (
              <div className="space-y-2">
                {inspector.tech_stack.map((ts) => (
                  <TechStackRow key={ts.name} stack={ts} />
                ))}
              </div>
            ) : (
              <p className="text-sm font-inter text-slate-500">No tech stack data on file.</p>
            )}
          </InspectorSection>
        </div>

        <SheetFooter className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px]">
              <ShieldCheck className="h-3 w-3 text-D4AF37" />
              <span className="font-inter text-slate-400">Source verified</span>
            </div>
            <a
              href={inspector.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-D4AF37 text-[#09090b] hover:bg-D4AF37/90 text-[10px] font-inter font-bold tracking-tight uppercase px-4 py-2 rounded-md transition-colors"
            >
              ↗️ Open Original Signal Source <ArrowRight className="ml-2 h-3 w-3" />
            </a>
          </div>
        </SheetFooter>
        <SheetClose className="absolute top-4 right-4" />
      </SheetContent>
    </Sheet>
  );
}

function InspectorBadge({ tier, color }: { tier: string; color: string }) {
  const label = tier.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-inter font-bold uppercase tracking-tighter text-${color === "D4AF37" ? "D4AF37" : "white"} border border-${color === "D4AF37" ? "D4AF37" : "white"}/20 bg-${color === "D4AF37" ? "D4AF37" : "white"}/5`}
    >
      {label}
    </span>
  );
}

function TechStackRow({ stack }: { stack: InspectorData["tech_stack"][number] }) {
  const style = MATURITY_STYLES[stack.maturity] ?? MATURITY_STYLES.transitioning;
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="7.5" y1="7.5" x2="16.5" y2="16.5"/></svg>
        </span>
        <span className="text-sm font-inter text-slate-300">{stack.name}</span>
        <span className="text-[9px] font-inter font-mono text-slate-500 uppercase tracking-tighter">
          {stack.category}
        </span>
      </div>
      <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${style}`}>
        {stack.maturity}
      </span>
    </div>
  );
}
