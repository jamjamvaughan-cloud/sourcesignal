export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-black text-[#94A3B8]">
      <div className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-medium tracking-tighter text-[#ffffff] italic">
                SourceSignal
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] max-w-xs">
              Commercial intelligence and procurement monitoring. Sector scope
              and plan entitlements are enforced server-side.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-mono tracking-[0.2em] text-[#ffffff] mb-4 uppercase">
              Product
            </h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#product" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Discovery</a></li>
              <li><a href="#product" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Opportunity analysis</a></li>
              <li><a href="#product" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Monitoring &amp; alerts</a></li>
              <li><a href="#product" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Source traceability</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-mono tracking-[0.2em] text-[#ffffff] mb-4 uppercase">
              Plans
            </h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#pricing" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Free</a></li>
              <li><a href="#pricing" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Pro — £99/month</a></li>
              <li><a href="#sectors" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Supported sectors</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-mono tracking-[0.2em] text-[#ffffff] mb-4 uppercase">
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#about" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">About</a></li>
              <li><a href="#" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Status</a></li>
              <li><a href="#" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Terms of service</a></li>
              <li><a href="#" className="text-[#94A3B8] hover:text-[#ffffff] transition-colors">Privacy policy</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
