import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section id="cta" className="px-4 py-24 sm:py-36 lg:py-48 bg-black radial-glare">
      <div className="mx-auto max-w-3xl">
        <div className="border border-white/[0.08] bg-black p-8 sm:p-12 text-center surface-panel">
          <Button variant="ghost" size="lg" className="btn-ghost-primary text-xs font-bold tracking-[0.15em] uppercase hover:text-black hover:bg-white">
            Get Pro <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
