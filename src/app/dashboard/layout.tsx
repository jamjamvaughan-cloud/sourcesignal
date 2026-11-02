import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Command Center | SourceSignal",
  description: "Commercial Intelligence Workstation.",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-col h-full bg-[#09090b] text-[#E5E5EA] overflow-x-hidden">
      <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 min-w-0">
        <div className="w-full min-w-0">{children}</div>
      </main>
    </div>
  );
}
