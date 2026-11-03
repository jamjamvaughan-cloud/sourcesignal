"use client";

/**
 * Profile Page — SourceSignal
 *
 * Allows users to edit their target countries, industries, and sub-categories,
 * and manage their Stripe subscription via the billing portal.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const STORED_COUNTRIES = ["UK", "US", "CA", "IE", "AU", "EU"];

const STORED_INDUSTRIES = [
  { id: "technology-infrastructure", label: "Technology Infrastructure" },
  { id: "energy", label: "Energy" },
  { id: "construction", label: "Construction" },
  { id: "healthcare-infrastructure", label: "Healthcare Infrastructure" },
  { id: "transport", label: "Transport" },
  { id: "logistics-and-distribution", label: "Logistics & Distribution" },
  { id: "public-sector-services", label: "Public Sector Services" },
];

const SUBCATEGORY_MAP: Record<string, { id: string; label: string }[]> = {
  "technology-infrastructure": [
    { id: "cloud-migration", label: "Cloud Migration" },
    { id: "enterprise-software", label: "Enterprise Software" },
    { id: "cybersecurity", label: "Cybersecurity" },
    { id: "data-center-operations", label: "Data Center Operations" },
    { id: "it-procurement", label: "IT Procurement" },
    { id: "digital-transformation", label: "Digital Transformation" },
  ],
  energy: [
    { id: "grid-modernization", label: "Grid Modernization" },
    { id: "renewable-energy-transition", label: "Renewable Energy Transition" },
    { id: "net-zero-compliance", label: "Net Zero Compliance" },
    { id: "utilities-infrastructure", label: "Utilities Infrastructure" },
    { id: "smart-metering", label: "Smart Metering" },
  ],
  construction: [
    { id: "building-safety-act-compliance", label: "Building Safety Act Compliance" },
    { id: "commercial-real-estate-development", label: "Commercial Real Estate Development" },
    { id: "public-works", label: "Public Works" },
    { id: "structural-engineering", label: "Structural Engineering" },
  ],
  "healthcare-infrastructure": [
    { id: "ehr-implementation", label: "EHR Implementation" },
    { id: "nhs-digital-plan-integration", label: "NHS Digital Plan Integration" },
    { id: "clinical-systems", label: "Clinical Systems" },
    { id: "medical-facility-procurement", label: "Medical Facility Procurement" },
  ],
  transport: [
    { id: "transport-decarbonisation", label: "Transport Decarbonisation" },
    { id: "smart-transit-systems", label: "Smart Transit Systems" },
    { id: "rail-aviation-infrastructure", label: "Rail & Aviation Infrastructure" },
    { id: "fleet-electrification", label: "Fleet Electrification" },
  ],
  "logistics-and-distribution": [
    { id: "supply-chain-automation", label: "Supply Chain Automation" },
    { id: "automated-warehousing", label: "Automated Warehousing" },
    { id: "freight-transport-logistics", label: "Freight & Transport Logistics" },
    { id: "inventory-management-systems", label: "Inventory Management Systems" },
  ],
  "public-sector-services": [
    { id: "government-digital-services", label: "Government Digital Services" },
    { id: "municipal-infrastructure", label: "Municipal Infrastructure" },
    { id: "defense-security-procurement", label: "Defense & Security Procurement" },
    { id: "cross-border-public-frameworks", label: "Cross-Border Public Frameworks" },
  ],
};

export default function ProfilePage() {
  const router = useRouter();
  const [planId, setPlanId] = React.useState<string>("free");
  const [userEmail, setUserEmail] = React.useState<string>("");
  const [countryPreferences, setCountryPreferences] = React.useState<string[]>([]);
  const [industryPreferences, setIndustryPreferences] = React.useState<string[]>([]);
  const [subCategoryPreferences, setSubCategoryPreferences] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function loadProfile() {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (!res.ok) return;
      const me = await res.json();
      if (me?.user) {
        setUserEmail(me.user.email);
        setCountryPreferences(me.user.country ? [me.user.country] : []);
        setPlanId(me.plan);
      }
    } catch {
      // Silent failure - profile will show defaults
    }
  }

  React.useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryPreferences,
          industryPreferences,
          subCategoryPreferences,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save preferences.");
        setSaving(false);
        return;
      }

      setSuccess("Preferences saved successfully.");
      setSaving(false);
    } catch {
      setError("Failed to save preferences. Please try again.");
      setSaving(false);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to open billing portal.");
        setPortalLoading(false);
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Failed to open billing portal.");
      setPortalLoading(false);
    }
  };

  const isPro = planId === "pro";

  return (
    <div className="space-y-8 section-enter max-w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
        <div>
          <h1 className="headline mb-0.5">Profile &amp; Settings</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
            Manage your preferences and subscription
          </p>
        </div>
        {isPro && (
          <Button
            onClick={handleOpenPortal}
            disabled={portalLoading}
            className="text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 hover:text-[#09090b] transition-all duration-200 ease-out px-4 py-2 rounded-sm"
          >
            {portalLoading ? "Opening…" : "Manage Subscription"} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-inter">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-inter">
          {success}
        </div>
      )}

      <div className="glass-card rounded-3xl border border-slate-800 p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
              Target Markets
            </p>
            <p className="text-xs font-inter text-slate-400">
              Countries, industries, and sub-categories you track
            </p>
          </div>
          <span className={`px-2 py-1 rounded text-[9px] font-inter font-bold ${isPro ? "bg-D4AF37/10 text-D4AF37 border border-D4AF37/20" : "bg-white/5 text-slate-500 border border-white/10"}`}>
            {isPro ? "Pro Plan" : "Free Plan"}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-3">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
              Target Countries
            </p>
            <div className="flex flex-wrap gap-2">
              {STORED_COUNTRIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const idx = countryPreferences.indexOf(c);
                    if (idx >= 0) {
                      setCountryPreferences(countryPreferences.filter((x) => x !== c));
                    } else {
                      setCountryPreferences([...countryPreferences, c]);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-inter font-bold transition-all duration-200 border text-center ${
                    countryPreferences.includes(c)
                      ? "bg-D4AF37 text-[#09090b] border-D4AF37 shadow-lg shadow-D4AF37/30"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
              Target Industries
            </p>
            <div className="flex flex-wrap gap-2">
              {STORED_INDUSTRIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const idx = industryPreferences.indexOf(s.id);
                    if (idx >= 0) {
                      setIndustryPreferences(industryPreferences.filter((x) => x !== s.id));
                    } else {
                      setIndustryPreferences([...industryPreferences, s.id]);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-inter font-bold transition-all duration-200 border text-left ${
                    industryPreferences.includes(s.id)
                      ? "bg-D4AF37 text-[#09090b] border-D4AF37 shadow-lg shadow-D4AF37/30"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] font-inter font-semibold uppercase tracking-wider text-slate-500">
              Target Sub-Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {industryPreferences.length > 0 ? (
                <>
                  <p className="text-[9px] font-inter text-slate-500 mb-2">
                    Select sub-categories for your chosen industries:
                  </p>
                  {industryPreferences
                    .flatMap((indId) => SUBCATEGORY_MAP[indId] || [])
                    .map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          const idx = subCategoryPreferences.indexOf(sc.id);
                          if (idx >= 0) {
                            setSubCategoryPreferences(subCategoryPreferences.filter((x) => x !== sc.id));
                          } else {
                            setSubCategoryPreferences([...subCategoryPreferences, sc.id]);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg text-[9px] font-inter font-bold transition-all duration-200 border text-left ${
                          subCategoryPreferences.includes(sc.id)
                            ? "bg-D4AF37 text-[#09090b] border-D4AF37 shadow-lg shadow-D4AF37/30"
                            : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                </>
              ) : (
                <p className="text-[9px] font-inter text-slate-400 italic">
                  Select industries above to see sub-categories.
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-D4AF37 text-[#09090b] font-inter font-bold text-xs tracking-wider uppercase hover:bg-D4AF37/90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Preferences"}
          </Button>
        </form>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
              Subscription
            </p>
            <p className="text-xs font-inter text-slate-400">
              Manage your Stripe billing and subscription
            </p>
          </div>
          <span className={`px-2 py-1 rounded text-[9px] font-inter font-bold ${isPro ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-500 text-slate-500 border border-white/5"}`}>
            {isPro ? "Active Pro" : "Free Tier"}
          </span>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-inter font-bold text-white">
                {isPro ? "Pro Plan — £99/month" : "Free Plan — £0/month"}
              </p>
              <p className="text-[9px] font-inter text-slate-400">
                {isPro
                  ? "Full access to all intelligence modules, exports, alerts, and webhooks."
                  : "Limited access to standard procurement notices. Upgrade for full intelligence."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-inter font-mono text-slate-500 tabular-nums">
                {userEmail.split("@")[1] || "—"}
              </p>
            </div>
          </div>

          {!isPro && (
            <Button
              onClick={() => router.push("/dashboard/billing")}
              className="w-full py-2 bg-D4AF37 text-[#09090b] font-inter font-bold text-xs tracking-wider uppercase hover:bg-D4AF37/90 transition-all"
            >
              Upgrade to Pro
            </Button>
          )}
          {isPro && (
            <Button
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="w-full py-2 border border-white/10 text-white font-inter font-bold text-xs tracking-wider uppercase hover:bg-white/5 transition-all"
            >
              {portalLoading ? "Opening…" : "Manage Subscription &amp; Cancel"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}