"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Feed" },
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/signals", label: "Signals" },
  { href: "/dashboard/saved", label: "Saved" },
  { href: "/dashboard/profile", label: "Profile" },
] as const;

export function DashboardLayoutShell() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        <Link
          href="/dashboard"
          className="flex flex-shrink-0 items-center gap-2.5"
          aria-label="SourceSignal dashboard"
        >
          <span className="grid h-6 w-6 place-items-center border border-white/25 font-mono text-[9px] font-bold text-white">
            S
          </span>
          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white sm:inline">
            SourceSignal
          </span>
        </Link>

        <nav
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
          aria-label="Dashboard navigation"
        >
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 flex-shrink-0 items-center whitespace-nowrap border px-3 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-transparent text-zinc-500 hover:border-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-emerald-400 md:flex">
            <span className="h-1.5 w-1.5 bg-emerald-400" />
            Live
          </span>
          <SignOutButton className="flex h-8 items-center gap-2 border border-white/10 px-2.5 font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:border-white/30 hover:text-white" />
        </div>
      </div>
    </header>
  );
}
