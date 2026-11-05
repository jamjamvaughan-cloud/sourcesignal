/**
 * Integrations Page — SourceSignal
 *
 * Server component that handles authentication + Pro tier gating, then
 * delegates the interactive webhook management UI to a client component.
 *
 * Requires Pro subscription (canConfigureIntegrations).
 */

import { getSessionContext } from "@/lib/backend";
import { canConfigureIntegrations, getUpgradeMessage } from "@/lib/tier-gating";
import { IntegrationsManager } from "@/components/integrations-manager";

export default async function IntegrationsPage() {
  const { planId, user } = await getSessionContext();
  const canIntegrations = canConfigureIntegrations(planId);

  if (!canIntegrations) {
    return (
      <div className="space-y-6 section-enter max-w-full min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="headline mb-0.5">Integrations</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
              Connect SourceSignal to your CRM and messaging tools.
            </p>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Pro Feature
          </div>
          <p className="text-[10px] font-inter text-slate-500 mb-2">
            {getUpgradeMessage("integrations")}
          </p>
          <button
            className="mt-1 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out px-4 py-2 rounded-sm font-inter font-semibold text-[10px] text-D4AF37 uppercase tracking-[0.1em]"
          >
            Upgrade to Pro — £99/month
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 section-enter max-w-full min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="headline mb-0.5">Integrations</h1>
            <p className="text-[10px] font-inter font-mono tracking-wider text-slate-500 uppercase">
              Configure webhook endpoints and delivery alerts.
            </p>
          </div>
        </div>
        <p className="text-[10px] font-inter text-slate-500">
          Sign in to manage webhook integrations.
        </p>
      </div>
    );
  }

  return <IntegrationsManager />;
}
