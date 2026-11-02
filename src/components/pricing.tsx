import { Button } from "@/components/ui/button";
import { FREE_PLAN, PRO_PLAN } from "@/lib/config";

interface FeatureRow {
  label: string;
  free: boolean;
  pro: boolean;
  note?: string;
}

export function Pricing() {
  const featureRows: readonly FeatureRow[] = [
    {
      label: "Access to all supported sectors",
      free: FREE_PLAN.features.find((f) => f.id === "all-sectors")?.included ?? false,
      pro: PRO_PLAN.features.find((f) => f.id === "all-sectors")?.included ?? false,
    },
    {
      label: "Opportunity details",
      free: true,
      pro: true,
      note: "Free: limited or truncated. Pro: full opportunity details.",
    },
    {
      label: "Full opportunity details",
      free: false,
      pro: true,
    },
    {
      label: "Buyer contact emails (where lawfully available)",
      free: false,
      pro: true,
    },
    {
      label: "Valuation estimates",
      free: false,
      pro: true,
    },
    {
      label: "CSV and JSON exports",
      free: false,
      pro: true,
    },
    {
      label: "Alerts",
      free: false,
      pro: true,
    },
    {
      label: "Full interactive opportunity map",
      free: false,
      pro: true,
    },
  ];

  return (
    <section id="pricing" className="px-4 py-24 sm:py-36 lg:py-48 bg-black">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="display-heading sm:text-6xl lg:text-7xl leading-none tracking-tight mb-6">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-[#94A3B8] body-copy">
            Start free. Upgrade to Pro when you need full opportunity details, exports and
            the live opportunity map.
          </p>
        </div>

        <div className="grid max-w-5xl mx-auto gap-6 lg:grid-cols-2 items-start">
          {[
            {
              ...FREE_PLAN,
              highlighted: false,
              button: "Start free",
            },
            {
              ...PRO_PLAN,
              highlighted: true,
              button: "Get Pro",
            },
          ].map((plan) => {
            const isPro = plan.id === "pro";
            return (
              <div
                key={plan.id}
                className={`surface-panel p-6 flex flex-col transition-all duration-300 ${isPro ? "border-white/[0.15] shadow-[0_0_30px_rgba(255,85,0,0.1)]" : "border-white/[0.05] hover:border-white/[0.15] hover:bg-black/20"}`}
              >
                <div className="mb-6">
                  <h3 className="text-lg font-medium tracking-tight text-[#ffffff]">
                    {plan.name}
                  </h3>
                  {isPro ? (
                    <p className="mt-1 text-xs font-mono tracking-[0.2em] text-[#FF5500] uppercase">
                      Most popular
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-mono tracking-[0.2em] text-[#94A3B8] uppercase">
                      Free forever
                    </p>
                  )}
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-medium text-[#ffffff] data-text">
                    {plan.priceGbp === null ? "£0" : "£99"}
                  </span>
                  <span className="text-sm text-[#94A3B8]">/ month</span>
                </div>

                <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-8">
                  {featureRows.map((row) => {
                    const enabled = isPro ? row.pro : row.free;
                    return (
                      <li key={row.label} className="flex items-start gap-3 text-sm">
                        <span
                          className={`flex h-5 w-5 items-center justify-center shrink-0 border text-[10px] font-mono uppercase ${enabled ? "bg-[#FF5500] text-[#000000] border-[#FF5500]" : "border-white/[0.15] text-[#94A3B8] border-white/[0.15]"}`}
                        >
                          {enabled ? "✓" : "—"}
                        </span>
                        <div className="text-[#ffffff] leading-relaxed">
                          {row.label}
                          {row.note && (
                            <span className="block text-[10px] text-[#94A3B8] mt-0.5">
                              {row.note}
                            </span>
                          )}
                          {!enabled && (
                            <span className="block text-[10px] text-[#94A3B8] mt-0.5">
                              Upgrade to Pro
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  className={[
                    "w-full",
                    isPro
                      ? "btn-ghost-primary text-xs font-bold tracking-[0.15em] uppercase hover:text-black hover:bg-white"
                      : "btn-ghost-hairline text-xs font-medium tracking-wider uppercase hover:text-white hover:border-white/30",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  variant={isPro ? "ghost" : "ghost"}
                  aria-label={`Get started with ${plan.name} plan`}
                >
                  {plan.id === "free" ? "Start free" : "Get Pro — £99/month"}
                </Button>

                {isPro && (
                  <p className="mt-4 text-[10px] text-[#FF5500]/90 text-center font-mono tracking-[0.15em] uppercase">
                    Upgrade gate: opportunity map and raw exports require Pro.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-12 text-xs font-mono tracking-[0.25em] text-[#94A3B8] text-center">
          Plan entitlements are enforced server-side — they are not merely
          hidden in the interface. Billing (Stripe) is planned for a later
          phase and is not yet operational.
        </p>
      </div>
    </section>
  );
}
