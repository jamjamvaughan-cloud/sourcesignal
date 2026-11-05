import { ArrowRight, Search, Building2, Bell, Link } from "lucide-react";

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: readonly WorkflowStep[] = [
  {
    step: 1,
    title: "Discovery",
    description:
      "Browse tender notices across all supported sectors and regions in one searchable index.",
    icon: Search,
  },
  {
    step: 2,
    title: "Opportunity analysis",
    description:
      "Review buyer history, estimated value, key dates and compliance requirements before deciding to bid.",
    icon: Building2,
  },
  {
    step: 3,
    title: "Monitoring",
    description:
      "Track live opportunities and receive alerts when documents, deadlines or buyers change (Pro).",
    icon: Bell,
  },
  {
    step: 4,
    title: "Source traceability",
    description:
      "Every opportunity links back to its originating notice with SHA-256 source provenance (planned).",
    icon: Link,
  },
];

export function Workflow() {
  return (
    <section id="product" className="px-4 py-24 sm:py-36 lg:py-48 bg-black">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="display-heading sm:text-6xl lg:text-7xl leading-none tracking-tight mb-6">
            How SourceSignal works
          </h2>
          <p className="text-lg text-[#94A3B8] body-copy">
            A repeatable workflow for turning procurement notices into won bids.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4 lg:max-w-[860px] mx-auto">
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="surface-panel p-4 flex flex-col items-center text-center surface-hover"
            >
              <div className="flex h-10 w-10 items-center justify-center bg-[#FF5500]/10 text-[#FF5500] mb-2 border border-[#FF5500]/30">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="text-[10px] font-mono tracking-[0.25em] text-[#94A3B8] mb-2 uppercase">
                Step {step.step}
              </span>
              <h3 className="text-base font-medium text-[#ffffff] mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex items-center justify-center">
          <ArrowRight className="h-6 w-6 text-[#71717A]" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
