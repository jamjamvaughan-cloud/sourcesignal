import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardLayoutShell } from "./layout-shell";

export const metadata: Metadata = {
  title: "Command Center | SourceSignal",
  description:
    "Commercial Opportunity Engine — real-time opportunity signals the second they drop.",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <DashboardLayoutShell />
      <main className="min-w-0 px-4 py-8 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}
