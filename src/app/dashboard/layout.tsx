import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardLayoutShell } from "./layout-shell";

export const metadata: Metadata = {
  title: "Command Center | SourceSignal",
  description: "Commercial Opportunity Engine — real-time procurement signals the second they drop.",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col h-full bg-[#050505] text-[#ffffff] overflow-x-hidden">
      <DashboardLayoutShell />
      <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 min-w-0">
        <div className="w-full min-w-0">{children}</div>
      </main>
    </div>
  );
}