"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Bookmark,
  Building2,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Executive Summary", icon: "overview" },
  { href: "/dashboard/opportunities", label: "Corporate Explorer", icon: "opportunities" },
  { href: "/dashboard/signals", label: "Predictive Signals", icon: "signals" },
  { href: "/dashboard/saved", label: "Saved Watchlist", icon: "saved" },
];

const ICONS: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  opportunities: Briefcase,
  signals: BarChart3,
  saved: Bookmark,
};

export function Sidebar({
  user,
  collapsed,
  setCollapsed,
}: {
  user: { email?: string };
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const [localCollapsed, setLocalCollapsed] = React.useState(false);
  const isCollapsed = collapsed ?? localCollapsed;
  const toggleCollapsed = setCollapsed ?? setLocalCollapsed;

  const router = useRouter();

  const handleSignOut = () => {
    fetch("/api/auth/signout", { method: "POST" }).then(() => {
      router.push("/");
    });
  };

  const isActive = (href: string) => pathname === href;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-800 bg-[#09090b]/90 backdrop-blur-xl text-slate-300 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header / Brand */}
      <div className="flex h-16 items-center justify-between px-3 border-b border-slate-800 bg-[#09090b]/90 backdrop-blur-md">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-D4AF37 to-b45309 flex items-center justify-center shadow-lg shadow-D4AF37/20">
              <span className="text-[9px] font-bold text-[#09090b]">S</span>
            </div>
            <span className="font-inter font-bold text-xs tracking-tight text-white">
              SourceSignal
            </span>
          </div>
        )}
        <button
          onClick={() => toggleCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Live Status Indicators — Removed */}
      <div className="px-3 py-4 border-b border-slate-800 bg-white/5 h-16"></div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {DASHBOARD_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl",
                isActive(item.href)
                  ? "bg-white/10 text-white border border-white/10 shadow-lg shadow-D4AF37/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-white hover:border-transparent",
              )}
            >
              {isCollapsed ? (
                <Icon className="h-4 w-4 flex-shrink-0" />
              ) : (
                <>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-inter">{item.label}</span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-3 h-[1px] bg-white/5" />

      {/* Secondary Nav */}
      <nav className="px-2 py-2 space-y-0.5">
        {[
          { href: "/dashboard/settings", label: "Settings", icon: "settings" },
          { href: "/", label: "Sign out", icon: "logout" },
        ].map((item) => {
          const Icon =
            item.icon === "settings" ? Settings : item.icon === "logout" ? LogOut : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === "/" ? handleSignOut : undefined}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-xs font-inter font-medium transition-all duration-200 ease-out rounded-xl",
                "text-slate-500 hover:bg-white/5 hover:text-slate-300",
              )}
            >
              {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
              {!isCollapsed && <span className="font-inter">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Workspace Switcher */}
      <div className="mt-auto px-3 py-4 border-t border-slate-800 bg-white/5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
            <span className="text-[10px] font-inter font-bold text-white">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-inter font-medium text-white truncate">
                {user.email || "User"}
              </p>
              <p className="text-[9px] font-inter text-slate-500 truncate uppercase tracking-tighter">
                Private Workspace
              </p>
            </div>
          )}
          <button
            className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Workspace switcher"
          >
            <Building2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Top bar with global search and user profile.
 */
export function TopBar() {
  const [searchQuery, setSearchQuery] = React.useState("");

  return (
    <div className="flex h-14 items-center justify-between px-6 bg-[#09090b]/60 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
      {/* Search Bar */}
      <div className="flex-1 max-w-lg min-w-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search opportunities, buyers, sectors…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-10 pr-3 text-xs font-inter text-slate-300 bg-slate-900/60 border border-slate-700 rounded-xl focus:border-D4AF37 focus:ring-0 transition-colors placeholder-slate-500"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-4 ml-auto">
        <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden text-[10px] font-inter font-bold text-white">
          J
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
