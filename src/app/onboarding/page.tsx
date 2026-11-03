"use client";

/**
 * Onboarding Wizard — SourceSignal
 *
 * New users are redirected here immediately after sign-up to select their
 * target country, industry, and sub-categories. These preferences drive the
 * opportunity feed and intelligence modules.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";


const STEPS = [
  { id: "country", label: "Country" },
  { id: "industry", label: "Industry" },
  { id: "subcategory", label: "Sub-Category" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const SECTORS = [
  { id: "technology-infrastructure", label: "Technology Infrastructure" },
  { id: "energy", label: "Energy" },
  { id: "construction", label: "Construction" },
  { id: "healthcare-infrastructure", label: "Healthcare Infrastructure" },
  { id: "transport", label: "Transport" },
  { id: "logistics-and-distribution", label: "Logistics & Distribution" },
  { id: "public-sector-services", label: "Public Sector Services" },
];

const SUBCATEGORIES: Record<string, { id: string; label: string }[]> = {
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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<StepId>("country");
  const [country, setCountry] = React.useState<string>("");
  const [industry, setIndustry] = React.useState<string>("");
  const [subCategory, setSubCategory] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryPreferences: [country],
          industryPreferences: [industry],
          subCategoryPreferences: subCategory ? [subCategory] : [],
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save preferences.");
        setSaving(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Failed to save preferences. Please try again.");
      setSaving(false);
    }
  };

  const canProceed =
    (step === "country" && !!country) ||
    (step === "industry" && !!industry) ||
    (step === "subcategory" && !!subCategory);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
      <div className="w-full max-w-2xl p-6">
        {/* Progress header */}
        <div className="mb-8">
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
            SourceSignal Onboarding
          </p>
          <h1 className="text-2xl font-inter font-bold text-white mb-2">
            Tell us what you track
          </h1>
          <p className="text-sm font-inter text-slate-400 mb-6">
            Select your target country, industry, and sub-category. This
            shapes your opportunity feed and intelligence alerts.
          </p>

          {/* Progress bar */}
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-D4AF37 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-inter font-mono text-slate-500">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`font-bold ${
                  currentStepIndex >= i ? "text-white" : "text-slate-600"
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl border border-slate-800 p-8">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-inter">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Step: Country */}
            <div
              className={`step-content mb-6 opacity-${
                step === "country" ? 1 : 0
              } transition-opacity duration-300`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
                    1. Target Country
                  </p>
                  <p className="text-xs font-inter text-slate-400">
                    Which country’s procurement market do you track?
                  </p>
                </div>
                <span className="text-xs font-inter font-bold text-D4AF37">
                  1 of 3
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["UK", "US", "CA", "IE", "AU", "EU"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCountry(c)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-inter font-bold transition-all duration-200 border ${
                      country === c
                        ? "bg-D4AF37 text-[#09090b] border-D4AF37 shadow-lg shadow-D4AF37/30"
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Step: Industry */}
            <div
              className={`step-content mb-6 opacity-${
                step === "industry" ? 1 : 0
              } transition-opacity duration-300`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
                    2. Industry
                  </p>
                  <p className="text-xs font-inter text-slate-400">
                    Which sector do you supply into?
                  </p>
                </div>
                <span className="text-xs font-inter font-bold text-D4AF37">
                  2 of 3
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SECTORS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setIndustry(s.id)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-inter font-bold transition-all duration-200 border text-left ${
                      industry === s.id
                        ? "bg-D4AF37 text-[#09090b] border-D4AF37 shadow-lg shadow-D4AF37/30"
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step: Sub-Category */}
            <div
              className={`step-content mb-6 opacity-${
                step === "subcategory" ? 1 : 0
              } transition-opacity duration-300`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-inter font-bold text-slate-500 uppercase tracking-wider">
                    3. Sub-Category
                  </p>
                  <p className="text-xs font-inter text-slate-400">
                    Choose your specific area of interest.
                  </p>
                </div>
                <span className="text-xs font-inter font-bold text-D4AF37">
                  3 of 3
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(industry ? SUBCATEGORIES[industry] ?? [] : []).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSubCategory(sc.id)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-inter font-bold transition-all duration-200 border text-left ${
                      subCategory === sc.id
                        ? "bg-D4AF37 text-[#09090b] border-D4AF37 shadow-lg shadow-D4AF37/30"
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
              {!industry && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/5 text-[10px] font-inter text-slate-400">
                  Select an industry above to see sub-categories.
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              {step === "subcategory" ? (
                <Button
                  type="submit"
                  disabled={saving || !canProceed}
                  className="w-full py-3 bg-D4AF37 text-[#09090b] font-inter font-bold text-xs tracking-wider uppercase hover:bg-D4AF37/90 transition-all disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Get Started"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={saving || !canProceed}
                  onClick={() =>
                    setStep(
                      STEPS[
                        Math.min(
                          currentStepIndex + 1,
                          STEPS.length - 1,
                        )
                      ].id,
                    )
                  }
                  className="w-full py-3 bg-D4AF37/20 text-D4AF37 font-inter font-bold text-xs tracking-wider border border-D4AF37/30 hover:bg-D4AF37 hover:text-[#09090b] transition-all disabled:opacity-50"
                >
                  {saving ? "Saving…" : `Next: ${
                    STEPS[currentStepIndex + 1].label
                  }`} <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}