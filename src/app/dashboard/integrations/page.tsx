import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlanIdFromPB } from "@/lib/auth";
import { type PlanId } from "@/lib/entitlements";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { canConfigureIntegrations, getUpgradeMessage } from "@/lib/tier-gating";

async function getUserPlanId(): Promise<PlanId> {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;
  if (!user) return "free";
  return getUserPlanIdFromPB(user.id);
}

export default async function IntegrationsPage() {
  const planId = await getUserPlanId();

  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const user = cookieHeader ? await getCurrentUser(cookieHeader) : null;

  const canIntegrations = canConfigureIntegrations(planId);

  if (!canIntegrations) {
    return (
      <div className="space-y-6 section-enter max-w-full min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="headline mb-0.5">Integrations</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Connect SourceSignal to your CRM and messaging tools.</p>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">Pro Feature</div>
          <p className="text-[10px] font-inter text-slate-500 mb-2">{getUpgradeMessage("integrations")}</p>
          <Button variant="ghost" className="mt-1 text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out px-4 py-2 rounded-sm">
            Upgrade to Pro — £99/month
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 section-enter max-w-full min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="headline mb-0.5">Integrations</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">Configure webhook endpoints and CRM connections. Secret values are never displayed in this interface.</p>
        </div>
      </div>

      {!user && (
        <EmptyState
          title="Sign in to configure integrations"
          description="Sign in to your account to manage API keys and configure webhook integrations."
        />
      )}

      <div className="grid gap-1 lg:grid-cols-3">
        <div className="glass-card p-4 glass-hover">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Webhook Endpoints</div>
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
        </div>

        <div className="glass-card p-4 glass-hover">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Webhook Logs</div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            <div className="p-3 border border-white/5 bg-[#0F0F11] rounded-sm">
              <div className="flex items-center justify-between text-[10px] font-inter font-mono">
                <span className="text-slate-300">tender.new</span>
                <span className="text-D4AF37">200 OK</span>
              </div>
              <p className="text-[10px] font-inter text-slate-500 tabular-nums mt-0.5">•••••••••• • 2m ago</p>
            </div>
            <div className="p-3 border border-white/5 bg-[#0F0F11] rounded-sm">
              <div className="flex items-center justify-between text-[10px] font-inter font-mono">
                <span className="text-slate-300">tender.awarded</span>
                <span className="text-slate-400">403 Forbidden</span>
              </div>
              <p className="text-[10px] font-inter text-slate-500 tabular-nums mt-0.5">•••••••••• • 45m ago</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 glass-hover">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">CRM Sync</div>
          <div className="space-y-2">
            <div className="p-3 border border-white/5 bg-[#0F0F11] flex items-center justify-between rounded-sm">
              <div>
                <p className="text-sm font-inter text-slate-300 font-medium">Salesforce</p>
                <p className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">Not connected</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">Connect</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 mt-6">
        <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">Security Notice</div>
        <p className="text-[10px] font-inter text-slate-500 mb-2">Secret keys and credentials are never rendered in this interface. All secret values are stored server-side and are only accessible at creation time via server-side API endpoints. Rotate credentials immediately if compromise is suspected.</p>
      </div>
    </div>
  );
}
