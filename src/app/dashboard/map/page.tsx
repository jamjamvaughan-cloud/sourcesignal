import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  canAccessFullMap,
  getUpgradeMessage,
} from "@/lib/tier-gating";
import { getSessionContext } from "@/lib/backend";

export default async function MapPage() {
  const { planId, user } = await getSessionContext();
  const canFullMapAccess = canAccessFullMap(planId);
  const userCountry = user?.country ?? null;

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-[#E5E5EA] overflow-x-hidden">
      <div className="flex h-16 items-center justify-between px-6 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-inter font-semibold tracking-tight text-white text-sm">Global Map</span>
        </div>
        <div className="text-[10px] font-inter font-mono text-slate-500 tabular-nums">Dark Projection · Cluster Pins</div>
      </div>

      <div className="flex-1 p-2">
        {canFullMapAccess ? (
          <div className="glass-card h-[calc(100vh-4rem)] relative overflow-hidden max-w-full min-w-0">
            <div className="absolute top-4 right-4 z-10 flex gap-1">
              <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">
                Satellite
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">
                Terrain
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] font-inter text-slate-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-sm">
                Clusters
              </Button>
            </div>
            <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
              <div className="px-3 py-1.5 border border-white/10 bg-[#09090b]/40 text-[10px] font-inter font-mono rounded-lg backdrop-blur-sm">
                <span className="text-slate-500">Clusters</span>
                <span className="text-D4AF37 font-semibold font-mono tabular-nums">14</span>
              </div>
              <div className="px-3 py-1.5 border border-white/10 bg-[#09090b]/40 text-[10px] font-inter font-mono rounded-lg backdrop-blur-sm">
                <span className="text-slate-500">Active Pins</span>
                <span className="text-D4AF37 font-semibold font-mono tabular-nums">312</span>
              </div>
              <div className="px-3 py-1.5 border border-white/10 bg-[#09090b]/40 text-[10px] font-inter font-mono rounded-lg backdrop-blur-sm">
                <span className="text-slate-500">Primary Region</span>
                <span className="text-D4AF37 font-semibold font-mono tabular-nums uppercase tracking-tighter">
                  {userCountry ?? "Global"}
                </span>
              </div>
            </div>
            <div className="absolute inset-0 bg-[#09090b] flex items-center justify-center text-slate-500 font-inter font-mono text-[10px] tabular-nums">
              Map rendering layer — WebGL context required
            </div>
          </div>
        ) : (
          <EmptyState
            title="Global Map"
            description={getUpgradeMessage("fullMap")}
            action={
              <Button variant="ghost" className="w-full text-[10px] font-inter font-semibold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 transition-all duration-200 ease-out px-4 py-2 rounded-sm">
                Upgrade to Pro — £99/month
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
