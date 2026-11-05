import { ArrowRight, Clock, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IllustrativeBadge } from "./illustrative-badge";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative isolate px-4 py-24 sm:py-36 lg:py-48 overflow-hidden bg-black radial-glare"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center lg:text-left">
          <div className="mb-6">
            <span className="eyebrow">Accepting early access registrations</span>
          </div>
          <h1 className="display-heading mt-6 sm:text-6xl lg:text-7xl leading-none tracking-tight mb-6">
            Procurement intelligence,{" "}
            <span className="block text-[#FF5500]">source by source.</span>
          </h1>
          <p className="text-lg text-[#94A3B8] body-copy max-w-2xl mx-auto sm:mx-0 lg:mt-8 lg:text-xl">
            Discover, evaluate and monitor public-sector and private procurement
            opportunities across 15 sectors. SourceSignal turns tender notices
            into actionable buyer intelligence — with full source traceability
            so you always know where an opportunity came from.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-start">
            <Button variant="ghost" size="lg" className="btn-ghost-primary w-full sm:w-auto text-xs font-bold tracking-[0.15em] uppercase">
              Start free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="btn-ghost-hairline w-full sm:w-auto text-xs font-medium tracking-wider uppercase hover:text-white hover:border-white/30"
            >
              Explore sectors
            </Button>
          </div>
          <IllustrativeBadge className="mt-8" />
        </div>

        <div className="mt-16 flex items-center justify-center">
          <div className="grid w-full max-w-xl gap-3 p-4 ambient-grid hairline">
            <div className="flex items-center gap-3 p-2 hairline">
              <ShieldCheck className="h-5 w-5 text-[#FF5500]" />
              <div>
                <h3 className="text-sm font-medium text-[#ffffff]">
                  Full source traceability
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Every opportunity links to its originating notice.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 hairline">
              <Target className="h-5 w-5 text-[#FF5500]" />
              <div>
                <h3 className="text-sm font-medium text-[#ffffff]">
                  15 supported sectors
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  From construction to defence and aerospace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 hairline">
              <Clock className="h-5 w-5 text-[#FF5500]" />
              <div>
                <h3 className="text-sm font-medium text-[#ffffff]">
                  Monitoring &amp; alerts
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Track opportunities as they evolve (Pro).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
