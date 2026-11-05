"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { Opportunity } from "@/components/opportunities-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function PreviewsPage() {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchOpportunities() {
      try {
        const res = await fetch(`${API_URL}/api/opportunities`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setOpportunities((data.items || []).slice(0, 6));
        }
      } catch {
        setOpportunities([]);
      } finally {
        setLoading(false);
      }
    }
    fetchOpportunities();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-black text-[#ffffff]">
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-medium tracking-tight text-[#ffffff]">
                Preview Opportunities
              </h1>
              <p className="text-[#71717A] text-sm mt-2">
                Live procurement opportunities across monitored sectors.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loading && (
              <div className="col-span-3 py-12 text-center">
                <p className="text-[10px] font-inter font-mono text-slate-400 animate-pulse">
                  Loading opportunities…
                </p>
              </div>
            )}

            {!loading && opportunities.length === 0 && (
              <div className="col-span-3 py-12 text-center">
                <p className="text-[10px] font-inter text-slate-400">
                  No opportunities available yet.
                </p>
              </div>
            )}

            {!loading && opportunities.length > 0 && (
              <>
                {opportunities.map((opp) => (
                  <Card key={opp.canonical_id}>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-[#ffffff]">
                        {opp.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs mt-2">
                        <span className="text-[9px] font-inter font-mono text-slate-500">
                          {opp.sector}
                        </span>
                        <span className="text-[9px] font-inter font-mono text-slate-500">
                          {opp.region}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {opp.buyer && (
                        <p className="text-[#71717A] text-sm mb-3">
                          Buyer: <span className="text-[#ffffff]">{opp.buyer}</span>
                        </p>
                      )}
                      {opp.estimated_value && (
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-xl font-medium text-[#ffffff]">
                            £{opp.estimated_value.toLocaleString()}
                          </span>
                          <span className="text-xs text-[#71717A]">
                            {opp.currency || "GBP"}
                          </span>
                        </div>
                      )}
                      {opp.closing_date && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs text-[#71717A]">
                            Closes {new Date(opp.closing_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Link
                        href={`/dashboard/opportunities/${opp.canonical_id}`}
                        className="w-full text-xs text-D4AF37 hover:text-D4AF37/80 underline transition-colors"
                      >
                        View Details
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>
      </main>
      <footer className="mt-12 border-t border-white/10 pt-8 text-center font-mono text-xs text-zinc-600">
        SourceSignal — Procurement Intelligence
      </footer>
    </div>
  );
}
