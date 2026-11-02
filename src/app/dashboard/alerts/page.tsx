import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlanIdFromPB } from "@/lib/auth";
import { type PlanId } from "@/lib/entitlements";
import { entitlementsFor } from "@/lib/entitlements";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

const ALERT_SECTORS = [
  "Construction", "Infrastructure", "Energy", "Industrial and Manufacturing",
  "Logistics and Distribution", "Technology Infrastructure", "Property and Real Estate",
  "Engineering", "Facilities Management", "Transport", "Water and Environment",
  "Telecommunications", "Healthcare Infrastructure", "Defence and Aerospace",
  "Public Sector Services",
];

async function getUserPlanId(): Promise<PlanId> {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) return "free";
  return getUserPlanIdFromPB(user.id);
}

export default async function AlertsPage() {
  const planId = await getUserPlanId();
  const entitlements = entitlementsFor(planId);

  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;

  if (!entitlements.alertsEnabled) {
    return (
      <div className="space-y-6 section-enter max-w-full min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="headline mb-0.5">Active Monitors</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Configure monitoring rules for commercial tender tracking.</p>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">Pro Feature</div>
          <p className="text-[10px] font-inter text-slate-500 mb-3">Active monitoring is available on the Pro plan. Upgrade to configure sector, region, and keyword-based rules.</p>
          <Button variant="ghost" className="mt-1 text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out px-4 py-2 rounded-sm">
            Upgrade to Pro — £99/month
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
        <div>
          <h1 className="headline mb-0.5">Active Monitors</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Rule-based monitoring for commercial tender tracking.</p>
        </div>
        <Button variant="ghost" className="text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out px-4 py-2 rounded-sm">
          Create Monitor
        </Button>
      </div>

      {!user && (
        <EmptyState
          title="Sign in to manage monitors"
          description="Sign in to your account to create, view, and manage your tender monitoring rules."
        />
      )}

      <div className="grid gap-1 lg:grid-cols-3">
        <div className="glass-card p-4 glass-hover">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Create New Monitor</div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="alertName" className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">Monitor Name</Label>
              <input className="h-10 text-xs px-3 w-full bg-transparent border-transparent text-white placeholder-slate-500 focus:border-D4AF37 focus:ring-0" placeholder="e.g. UK Construction tenders" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">Sectors</label>
              <div className="flex flex-wrap gap-1">
                {ALERT_SECTORS.map((s) => (
                  <button key={s} type="button" className="border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-inter font-mono text-slate-400 hover:bg-D4AF37/5 hover:border-D4AF37/20 hover:text-[#E5E5EA] transition-all duration-200 ease-out rounded-sm">{s}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">Keywords</label>
              <input className="h-10 text-xs px-3 w-full bg-transparent border-transparent text-white placeholder-slate-500 focus:border-D4AF37 focus:ring-0" placeholder="e.g. roofing, refurbishment" />
            </div>
            <Button variant="ghost" className="w-full text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out rounded-sm px-4 py-2">Create Monitor</Button>
          </div>
        </div>

        <div className="glass-card p-4 glass-hover">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Active Triggers</div>
          <div className="space-y-2">
            <div className="p-3 border border-white/5 bg-white/5 flex items-center justify-between rounded-sm">
              <div>
                <p className="text-sm font-inter font-semibold text-[#E5E5EA]">UK Construction — Published</p>
                <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">Every 6 hours · Last fired 2h ago</p>
              </div>
              <button className="h-5 w-5 border border-white/10 bg-D4AF37 text-[#09090b] rounded-sm" aria-label="Enable monitor" />
            </div>
            <div className="p-3 border border-white/5 bg-white/5 flex items-center justify-between rounded-sm">
              <div>
                <p className="text-sm font-inter font-semibold text-[#E5E5EA]">Energy — Megaprocurement</p>
                <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">Daily · Last fired 1d ago</p>
              </div>
              <button className="h-5 w-5 border border-white/10 bg-white/5 text-slate-400 rounded-sm" aria-label="Disable monitor" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
