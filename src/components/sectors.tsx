import { SECTORS } from "@/lib/config";

export function Sectors() {
  return (
    <section id="sectors" className="px-4 py-24 sm:py-36 lg:py-48 bg-black">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="display-heading sm:text-6xl lg:text-7xl leading-none tracking-tight mb-6">
            Supported sectors
          </h2>
          <p className="text-lg text-[#94A3B8] body-copy">
            SourceSignal tracks procurement opportunities across these sectors.
            Sector scope is enforced server-side, so your plan entitlements
            apply consistently everywhere.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SECTORS.map((sector) => (
            <div
              key={sector.id}
              className="surface-panel p-4 surface-hover group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono tracking-[0.2em] text-[#FF5500] uppercase">
                  {sector.id.toUpperCase()}
                </span>
                <span className="text-xs font-mono text-[#94A3B8]">
                  {sector.id.length} ch
                </span>
              </div>
              <h3 className="text-sm font-medium text-[#ffffff] tracking-tight">
                {sector.name}
              </h3>
              <p className="text-[10px] text-[#94A3B8] mt-2 leading-tight">
                {sector.description}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs font-mono tracking-[0.25em] text-[#94A3B8] text-center">
          {SECTORS.length} supported sectors &middot;{" "}
          <span className="font-medium">All sectors available on Free and Pro.</span>
        </p>
      </div>
    </section>
  );
}
