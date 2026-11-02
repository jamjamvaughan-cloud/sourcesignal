"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MACRO_SECTORS } from "@/lib/config/sectors";
import { COUNTRIES } from "@/types";

const PROFILE_TABS = [
  { id: "general", label: "General" },
  { id: "billing", label: "Billing & Plan" },
  { id: "integrations", label: "API & Integrations" },
  { id: "security", label: "Security" },
];

interface ProfilePageClientProps {
  initialPlanId: "free" | "pro";
  initialEntitlements: {
    fullDetailsEnabled: boolean;
    buyerEmailsEnabled: boolean;
    exportsEnabled: boolean;
    alertsEnabled: boolean;
    mapEnabled: boolean;
  };
  user: { email?: string } | null;
}

export function ProfilePageClient({
  initialPlanId,
  initialEntitlements,
  user,
}: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = React.useState("general");
  const planId = initialPlanId;
  const entitlements = initialEntitlements;

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="headline mb-0.5">Workspace Profile</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Manage organization, billing, and security.</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 overflow-x-auto scrollbar-hide">
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-inter font-semibold transition-all duration-200 ease-out whitespace-nowrap ${activeTab === tab.id ? "bg-white/5 text-white border-r-2 border-r-D4AF37 filter-active" : "text-slate-400 hover:bg-white/5 hover:text-white interactive-tab"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-1 lg:grid-cols-3">
        {activeTab === "general" && (
          <div className="lg:col-span-2">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-4">Organization Profile</div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 bg-white/5 flex items-center justify-center border border-white/10 rounded-sm">
                  <span className="text-[10px] font-inter font-bold text-slate-300">{user?.email?.charAt(0).toUpperCase() || "U"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-inter font-medium text-[#E5E5EA]">{user?.email || "Not signed in"}</p>
                  <p className="text-[10px] font-inter text-slate-500">Account owner</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">Plan</p>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center text-[10px] font-inter font-semibold uppercase rounded-sm ${planId === "pro" ? "bg-D4AF37 text-[#09090b] border-D4AF37" : "border-white/10 text-slate-400 border-white/10"}`}>
                    {planId.charAt(0).toUpperCase() + planId.slice(1)}
                  </span>
                  <p className="text-sm font-inter text-slate-400">{planId === "pro" ? "£99/month" : "Free"}</p>
                </div>
                <label className="flex items-center gap-2 text-[10px] font-inter text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="switch-control"
                    defaultChecked={planId === "pro"}
                    aria-label="Pro Access"
                  />
                  <span className="text-[10px] font-inter font-semibold text-[#E5E5EA]">Pro Access</span>
                </label>
              </div>
              <div className="space-y-3 mt-4">
                <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">Preferred Industries</p>
                <p className="text-[10px] font-inter text-slate-500 mb-3">
                  Select the sectors that matter most to your organization. These
                  configure the signal detector to prioritize early direct links
                  for your target industries.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {MACRO_SECTORS.map((macroSector) => (
                    <div key={macroSector.id} className="p-2 border border-white/5 bg-white/5 rounded-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-inter font-bold text-D4AF37 uppercase tracking-wider">
                          {macroSector.name}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {macroSector.subIndustries.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 p-1.5 text-[10px] font-inter text-slate-400 border border-white/10 bg-[#0F0F11] hover:bg-white/5 hover:border-white/20 transition-all duration-200 ease-out rounded-sm">
                            <input
                              type="checkbox"
                              className="switch-control"
                              defaultChecked
                              aria-label={`Prefer ${sub.name}`}
                            />
                            <span className="font-inter text-sm">{sub.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <p className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">Primary Jurisdiction</p>
                <p className="text-[10px] font-inter text-slate-500 mb-3">
                  Select your primary region. This configures the signal detector
                  to surface early direct signal sources for your jurisdiction.
                </p>
                <Select defaultValue="UK">
                  <SelectTrigger className="h-10 text-xs px-3 w-full bg-transparent border-transparent text-white focus:border-D4AF37 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="p-2 bg-[#09090b] border border-white/10">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="lg:col-span-2">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-4">Billing & Plan</div>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Plan</div>
                  <p className="text-sm font-inter text-[#E5E5EA]">{planId === "pro" ? "Pro" : "Free"} — {planId === "pro" ? "£99/month" : "£0/month"}</p>
                </div>
                {planId !== "pro" ? (
                  <Button variant="ghost" className="w-full text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out px-4 py-2 rounded-sm">
                    Upgrade to Pro — £99/month
                  </Button>
                ) : (
                  <div className="p-3 border border-white/10 bg-[#0F0F11] rounded-sm">
                    <p className="text-[10px] font-inter text-slate-400 mb-2">Next billing date: 1 Nov 2026</p>
                    <p className="text-[10px] font-inter text-slate-400">Payment method: ···· 4242</p>
                  </div>
                )}
              </div>
              <div className="mt-6">
                <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Usage Telemetry</div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-inter font-mono text-slate-500 tabular-nums mb-0.5">
                      <span>API Requests</span>
                      <span>12,450 / 50,000</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 overflow-hidden rounded-full">
                      <div className="h-full bg-D4AF37/60" style={{ width: "25%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-inter font-mono text-slate-500 tabular-nums mb-0.5">
                      <span>Exports This Month</span>
                      <span>3 / 10</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 overflow-hidden rounded-full">
                      <div className="h-full bg-D4AF37/60" style={{ width: "30%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="lg:col-span-2">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-4">API & Integrations</div>
              <div className="space-y-2">
                <div className="p-3 border border-white/5 bg-[#0F0F11] flex items-center justify-between rounded-sm">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-inter font-medium text-[#E5E5EA]">Production Webhook</p>
                    <p className="text-[10px] font-inter text-slate-400 tabular-nums">••••••••••••••••••••••••••••••••</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">
                      Rotate
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-500 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Webhook Logs</div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  <div className="p-3 border border-white/5 bg-[#0F0F11] rounded-sm">
                    <div className="flex items-center justify-between text-[10px] font-inter font-mono">
                      <span className="text-slate-300">tender.new</span>
                      <span className="text-D4AF37">200 OK</span>
                    </div>
                    <p className="text-[10px] font-inter text-slate-500 tabular-nums mt-0.5">•••••••••• • 2m ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="lg:col-span-2">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-4">Security</div>
              <div className="space-y-3">
                <div className="p-3 border border-white/5 bg-[#0F0F11] flex items-center justify-between rounded-sm">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">Add a second layer of account protection.</p>
                  </div>
                  <input type="checkbox" className="switch-control" />
                </div>
                <div className="p-3 border border-white/5 bg-[#0F0F11] flex items-center justify-between rounded-sm">
                  <div className="space-y-0.5">
                    <p className="text-sm font-inter font-medium text-[#E5E5EA]">Session Management</p>
                    <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">View and revoke active sessions.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">
                    Manage Sessions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right column: Plan Entitlements */}
        {(activeTab === "general" || activeTab === "billing") && (
          <div className="lg:col-span-1">
            <div className="glass-card p-4">
              <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Plan Entitlements</div>
              <div className="space-y-2">
                {[
                  { id: "all-sectors", label: "All Supported Sectors", included: true },
                  { id: "tender-details", label: "Tender Details", included: true, note: planId === "free" ? "Limited detail" : "Full detail" },
                  { id: "full-details", label: "Full Tender Details", included: entitlements.fullDetailsEnabled },
                  { id: "buyer-emails", label: "Buyer Contact Emails", included: entitlements.buyerEmailsEnabled },
                  { id: "valuations", label: "Valuation Estimates", included: entitlements.fullDetailsEnabled },
                  { id: "raw-exports", label: "CSV and JSON Exports", included: entitlements.exportsEnabled },
                  { id: "monitors", label: "Active Monitors", included: entitlements.alertsEnabled },
                  { id: "global-map", label: "Global Map", included: entitlements.mapEnabled },
                ].map((feature) => (
                  <div key={feature.id} className="flex items-center gap-2 text-sm">
                    <span className={`flex h-6 w-6 items-center justify-center text-[10px] font-inter font-semibold uppercase rounded-sm ${feature.included ? "bg-D4AF37 text-[#09090b] border-D4AF37" : "border-white/10 text-slate-400 border-white/10"}`}>
                      {feature.included ? "✓" : "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-inter text-slate-400 truncate">{feature.label}</p>
                      {feature.note && <p className="text-[10px] font-inter text-slate-500 truncate">{feature.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
