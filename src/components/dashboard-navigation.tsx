"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Bookmark,
  Bell,
  Map,
  PlugZap,
  User,
  Shield,
  Menu,
  X,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  opportunities: Briefcase,
  saved: Bookmark,
  alerts: Bell,
  map: Map,
  integrations: PlugZap,
  profile: User,
  pipeline: Briefcase,
};

const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Intelligence", icon: "overview" },
  { href: "/dashboard/opportunities", label: "Opportunities", icon: "opportunities" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/dashboard/alerts", label: "Monitors", icon: "alerts" },
  { href: "/dashboard/map", label: "Global Map", icon: "map" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" },
  { href: "/dashboard/profile", label: "Profile", icon: "profile" },
];

interface NavLinkProps {
  active?: boolean;
  className?: string;
  Icon?: React.ElementType;
  label: string;
  href: string;
}

function NavLink({
  active,
  className,
  Icon: IconComponent,
  label,
  href,
  ...restProps
}: NavLinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const Icon = IconComponent;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 w-full px-4 py-3 text-sm transition-all duration-200 ease-out",
        active
          ? "bg-white/5 text-white border-r-2 border-r-D4AF37"
          : "text-slate-400 hover:bg-white/5 hover:text-white hover:border-transparent",
        className,
      ].join(" ")}
      {...restProps}
    >
      {Icon ? <Icon className="h-5 w-5 flex-shrink-0" /> : null}
      <span className="font-inter font-medium">{label}</span>
    </Link>
  );
}

export function DashboardNavigation({ user }: { user: { email?: string } }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleSignOut = () => {
    fetch("/api/auth/signout", { method: "POST" }).then(() => {
      router.push("/");
    });
  };

  return (
    <>
      {/* Desktop sidebar — hidden on mobile/tablet */}
      <aside className="hidden lg:flex flex-col fixed lg:sticky lg:top-0 inset-y-0 left-0 z-30 w-72 border-r border-white/5 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-6 border-b border-white/5 bg-[#09090b]/80">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-D4AF37 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#09090b]">S</span>
            </div>
            <span className="font-inter font-semibold tracking-tight text-white text-sm">
              SourceSignal
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-1">
          <nav className="space-y-0.5">
            {DASHBOARD_NAV.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  active={isActive(item.href)}
                  Icon={Icon}
                  label={item.label}
                />
              );
            })}
          </nav>

          <div className="mt-12 pt-6 border-t border-white/5">
            <div className="px-4 pb-4 text-[10px] font-inter font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Workspace
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-9 w-9 bg-white/5 flex items-center justify-center border border-white/10 rounded-sm">
                <span className="text-[10px] font-inter font-bold text-slate-300">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-inter font-medium text-white truncate">
                  {user.email || "User"}
                </p>
                <p className="text-[10px] font-inter text-slate-500 truncate">
                  Private Workspace
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-inter font-medium text-D4AF37 hover:bg-white/5 hover:text-white transition-all duration-200 ease-out border-0"
            >
              <Shield className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile/tablet overlay */}
      <div className="lg:hidden fixed inset-0 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 ease-out rounded-sm"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div
          className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } bg-[#09090b]/95 backdrop-blur-md border-r border-white/5`}
        >
          <div className="flex h-16 items-center justify-between px-4 border-b border-white/5 bg-[#09090b]/95">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-D4AF37 flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#09090b]">S</span>
              </div>
              <span className="font-inter font-semibold tracking-tight text-white text-sm">
                SourceSignal
              </span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 ease-out rounded-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-1">
            <nav className="space-y-0.5">
              {DASHBOARD_NAV.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    active={isActive(item.href)}
                    Icon={Icon}
                    label={item.label}
                    onClick={() => setMobileOpen(false)}
                  />
                );
              })}
            </nav>
          </div>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-[#09090b]/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        )}
      </div>
    </>
  );
}
