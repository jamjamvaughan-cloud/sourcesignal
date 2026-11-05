"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard-layout-shell";
import { TopBar } from "@/components/dashboard-layout-shell";

interface DashboardShellProps {
  user: { email?: string };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-[#E5E5EA] overflow-x-hidden">
      <Sidebar user={user} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300 ease-in-out",
          collapsed ? "lg:ml-4" : "lg:ml-16",
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 min-w-0">
          <div className="w-full min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
