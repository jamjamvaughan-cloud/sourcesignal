"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Bookmark,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function DashboardLayoutShell() {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-[#050505] text-[#E5E5EA] transition-all duration-300 ease-in-out ${collapsed ? "w-16" : "w-64"}`}
    >
      <div className="flex h-16 items-center justify-between px-3 border-b border-white/10 bg-[#050505]">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-[#09090b] flex items-center justify-center border border-white/10">
            <span className="text-[9px] font-mono font-bold text-[#ffffff]">S</span>
          </div>
          {!collapsed && (
            <span className="font-mono font-bold text-[9px] tracking-tight text-[#ffffff]">
              SourceSignal
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-[#E5E5EA]/50 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 w-full px-3 py-2.5 text-[9px] font-mono font-medium transition-all duration-200 ease-out rounded-lg bg-white/10 text-[#ffffff] border border-white/10 shadow-lg shadow-D4AF37/10"
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
          <span className={`font-mono ${collapsed ? "hidden" : ""}`}>
            Executive Summary
          </span>
        </Link>
        <Link
          href="/dashboard/opportunities"
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl text-slate-400 hover:bg-white/5 hover:text-white hover:border-transparent"
        >
          <Briefcase className="h-4 w-4 flex-shrink-0" />
          <span className={`font-mono ${collapsed ? "hidden" : ""}`}>
            Opportunity Explorer
          </span>
        </Link>
        <Link
          href="/dashboard/signals"
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl text-slate-400 hover:bg-white/5 hover:text-white hover:border-transparent"
        >
          <BarChart3 className="h-4 w-4 flex-shrink-0" />
          <span className={`font-inter ${collapsed ? "hidden" : ""}`}>
            Predictive Signals
          </span>
        </Link>
        <Link
          href="/dashboard/saved"
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl text-slate-400 hover:bg-white/5 hover:text-white hover:border-transparent"
        >
          <Bookmark className="h-4 w-4 flex-shrink-0" />
          <span className={`font-inter ${collapsed ? "hidden" : ""}`}>
            Saved Watchlist
          </span>
        </Link>
      </nav>

      <div className="mx-3 my-3 h-[1px] bg-white/10" />

      <nav className="px-2 py-2 space-y-0.5">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl text-slate-500 hover:bg-white/5 hover:text-white hover:border-transparent"
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          <span className={`font-mono ${collapsed ? "hidden" : ""}`}>
            Profile
          </span>
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button
            className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl text-slate-500 hover:bg-white/5 hover:text-white hover:border-transparent"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className={`font-inter ${collapsed ? "hidden" : ""}`}>
              Sign out
            </span>
          </button>
        </form>
      </nav>
    </aside>
  );
}