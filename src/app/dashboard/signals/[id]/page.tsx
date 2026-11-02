import Link from "next/link";
import { ChevronRight, ExternalLink, ShieldCheck, Clock, Users, Building, Target } from "lucide-react";

interface SignalDetail {
  id: string;
  canonical_id: string;
  title: string;
  sector: string;
  region: string;
  country: string;
  buyer: string;
  predicted_value: number;
  currency: string;
  confidence: number;
  signal_tier: string;
  displacement_probability: number;
  timeframe: string;
  primary_driver: string;
  recommended_action: string;
  status: "active" | "monitoring" | "validated";
  source_url: string;
  source_name: string;
  summary: string;
  decision_makers: Array<{
    name: string;
    title: string;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
  }>;
  tech_stack: Array<{
    name: string;
    category: string;
    maturity: "legacy" | "modern" | "transitioning";
  }>;
  displacement_reasons: string[];
  renewal_date?: string | null;
  annual_spend?: number | null;
}

const SIGNAL_DETAILS: Record<string, SignalDetail> = {
  "sig-001": {
    id: "sig-001",
    canonical_id: "SS-UK-NHS-2026-001",
    title: "UK NHS Digital Infrastructure Refresh",
    sector: "Healthcare",
    region: "ENG",
    country: "UK",
    buyer: "NHS England",
    predicted_value: 85000000,
    currency: "GBP",
    confidence: 92,
    signal_tier: "MEGAPROCUREMENT",
    displacement_probability: 78,
    timeframe: "Q1 2027",
    primary_driver: "Legacy mainframe decommission + cloud sovereignty mandate",
    recommended_action: "Engage CIO and procurement lead before RFP publication",
    status: "validated",
    source_url: "https://www.gov.uk/government/publications/nhs-digital-infrastructure-refresh",
    source_name: "UK Government Digital Marketplace",
    summary:
      "The NHS is undertaking a multi-year digital infrastructure refresh to replace legacy mainframe systems with modern cloud-native platforms. This displacement opportunity targets vendors currently providing legacy infrastructure to NHS trusts across England. The cloud sovereignty mandate requires UK-hosted data, creating a natural displacement path for non-UK hyperscalers.",
    decision_makers: [
      {
        name: "Dr. Sarah Thompson",
        title: "Chief Information Officer",
        email: "s.thompson@nhsx.nhs.uk",
        phone: "+44 20 7946 0123",
        linkedin: "https://linkedin.com/in/sarahthompson-nhs",
      },
      {
        name: "Michael Okonkwo",
        title: "Director of Procurement",
        email: "m.okonkwo@nhsbsa.nhs.uk",
        phone: "+44 20 7946 0456",
        linkedin: "https://linkedin.com/in/michaelokonkwo",
      },
    ],
    tech_stack: [
      { name: "IBM z15 Mainframe", category: "Compute", maturity: "legacy" },
      { name: "Oracle Database 11g", category: "Database", maturity: "legacy" },
      { name: "Microsoft Azure", category: "Cloud", maturity: "modern" },
      { name: "VMware vSphere", category: "Virtualization", maturity: "legacy" },
    ],
    displacement_reasons: [
      "Cloud sovereignty mandate requires UK-hosted data",
      "Legacy mainframe end-of-life support ending 2027",
      "300% increase in annual licensing costs",
      "Skills shortage for mainframe developers",
    ],
    renewal_date: "2027-03-31",
    annual_spend: 85000000,
  },
  "sig-002": {
    id: "sig-002",
    canonical_id: "SS-DE-DB-2026-014",
    title: "Deutsche Bundesbahn Rail Modernisation",
    sector: "Transport",
    region: "EU",
    country: "DE",
    buyer: "Deutsche Bahn AG",
    predicted_value: 120000000,
    currency: "EUR",
    confidence: 85,
    signal_tier: "MEGAPROCUREMENT",
    displacement_probability: 65,
    timeframe: "Q3 2027",
    primary_driver: "SAP ERP displacement with open-core alternative",
    recommended_action: "Position modular ERP pilot before budget cycle",
    status: "active",
    source_url: "https://www.deutschebahn.com/en/procurement",
    source_name: "Deutsche Bahn Procurement Portal",
    summary:
      "Deutsche Bahn is modernising its rail operations with a new ERP platform to replace its legacy SAP implementation. The displacement opportunity targets the ERP and associated modules across freight, passenger, and infrastructure divisions. German data sovereignty requirements favour EU-based providers.",
    decision_makers: [
      {
        name: "Klaus Weber",
        title: "CIO, Deutsche Bahn",
        email: "k.weber@deutschebahn.com",
        phone: "+49 69 555 0123",
        linkedin: "https://linkedin.com/in/klausweber-db",
      },
      {
        name: "Anna Schmidt",
        title: "Head of IT Procurement",
        email: "a.schmidt@deutschebahn.com",
        phone: "+49 69 555 0124",
        linkedin: "https://linkedin.com/in/annaschmidt-db",
      },
    ],
    tech_stack: [
      { name: "SAP ECC 6.0", category: "ERP", maturity: "legacy" },
      { name: "SAP HANA", category: "Database", maturity: "modern" },
      { name: "Microsoft Windows Server", category: "OS", maturity: "legacy" },
    ],
    displacement_reasons: [
      "SAP ECC mainstream maintenance ends 2027",
      "German data sovereignty requirements",
      "High total cost of ownership",
      "Rigid customization limitations",
    ],
    renewal_date: "2027-09-30",
    annual_spend: 120000000,
  },
  "sig-003": {
    id: "sig-003",
    canonical_id: "SS-FR-MOD-2026-033",
    title: "French Ministry of Defence Cloud Programme",
    sector: "Defence",
    region: "EU",
    country: "FR",
    buyer: "Ministère des Armées",
    predicted_value: 210000000,
    currency: "EUR",
    confidence: 88,
    signal_tier: "MEGAPROCUREMENT",
    displacement_probability: 72,
    timeframe: "Q2 2027",
    primary_driver: "US hyperscaler replacement under cloud sovereignty law",
    recommended_action: "Engage security accreditation team early",
    status: "active",
    source_url: "https://www.defense.gouv.fr/achats",
    source_name: "French Defence Procurement",
    summary:
      "The French Ministry of Defence is displacing US hyperscaler cloud services with EU-hosted alternatives under France's cloud sovereignty law (Cloud de Confiance). This covers compute, storage, and AI workloads across defence operations. ANSSI qualification is required for all providers.",
    decision_makers: [
      {
        name: "Colonel Marie Dubois",
        title: "Chief Digital Officer",
        email: "m.dubois@defense.gouv.fr",
        phone: "+33 1 40 61 23 45",
        linkedin: "https://linkedin.com/in/mariedubois-mod",
      },
      {
        name: "Jean-Pierre Martin",
        title: "Director of Acquisition",
        email: "jp.martin@defense.gouv.fr",
        phone: "+33 1 40 61 23 46",
        linkedin: "https://linkedin.com/in/jeanpierremartin",
      },
    ],
    tech_stack: [
      { name: "AWS GovCloud", category: "Cloud", maturity: "legacy" },
      { name: "Microsoft Azure", category: "Cloud", maturity: "legacy" },
      { name: "VMware Cloud Foundation", category: "Virtualization", maturity: "legacy" },
    ],
    displacement_reasons: [
      "Cloud de Confiance law requires EU-hosted data",
      "ANSSI security qualification required",
      "US CLOUD Act compliance concerns",
      "Strategic autonomy mandate",
    ],
    renewal_date: "2027-06-30",
    annual_spend: 210000000,
  },
  "sig-004": {
    id: "sig-004",
    canonical_id: "SS-CA-PSC-2026-044",
    title: "Canadian Federal Procurement Portal",
    sector: "Government",
    region: "CA",
    country: "CA",
    buyer: "Public Services and Procurement Canada",
    predicted_value: 45000000,
    currency: "CAD",
    confidence: 79,
    signal_tier: "HIGH_CAP",
    displacement_probability: 58,
    timeframe: "Q4 2026",
    primary_driver: "Legacy Ariba instance end-of-life",
    recommended_action: "Submit capability statement ahead of RFI",
    status: "monitoring",
    source_url: "https://buyandsell.gc.ca/",
    source_name: "CanadaBuys Procurement Portal",
    summary:
      "Public Services and Procurement Canada is replacing its legacy SAP Ariba procurement portal with a modern procurement platform. The displacement covers the full source-to-pay cycle for federal departments. Canadian Content requirements and security clearance are key evaluation criteria.",
    decision_makers: [
      {
        name: "Robert Chen",
        title: "Assistant Commissioner, Procurement",
        email: "r.chen@pspc-tpsgc.gc.ca",
        phone: "+1 819 956 2345",
        linkedin: "https://linkedin.com/in/robertchen-pspc",
      },
      {
        name: "Sarah MacDonald",
        title: "Director of Digital Procurement",
        email: "s.macdonald@pspc-tpsgc.gc.ca",
        phone: "+1 819 956 2346",
        linkedin: "https://linkedin.com/in/sarahmacdonald",
      },
    ],
    tech_stack: [
      { name: "SAP Ariba", category: "Procurement", maturity: "legacy" },
      { name: "SAP ERP", category: "ERP", maturity: "legacy" },
    ],
    displacement_reasons: [
      "Ariba legacy instance end-of-life",
      "Canadian Content requirements",
      "Security clearance requirements",
      "Modern source-to-pay capabilities needed",
    ],
    renewal_date: "2026-12-31",
    annual_spend: 45000000,
  },
  "sig-005": {
    id: "sig-005",
    canonical_id: "SS-AU-NSW-2026-055",
    title: "Australian State Health Records Migration",
    sector: "Healthcare",
    region: "AU",
    country: "AU",
    buyer: "NSW Health",
    predicted_value: 62000000,
    currency: "AUD",
    confidence: 81,
    signal_tier: "HIGH_CAP",
    displacement_probability: 69,
    timeframe: "Q1 2027",
    primary_driver: "Electronic health records platform consolidation",
    recommended_action: "Partner with local systems integrator",
    status: "active",
    source_url: "https://www.health.nsw.gov.au/procurement",
    source_name: "NSW Health Procurement",
    summary:
      "NSW Health is consolidating multiple electronic health records (EHR) platforms into a single statewide solution. The displacement opportunity targets legacy EHR vendors across local health districts. Australian data residency and privacy requirements (Privacy Act 1988) apply to all health data.",
    decision_makers: [
      {
        name: "Dr. Emma Wilson",
        title: "Chief Clinical Information Officer",
        email: "e.wilson@health.nsw.gov.au",
        phone: "+61 2 9391 9000",
        linkedin: "https://linkedin.com/in/emmawilson-nswhealth",
      },
      {
        name: "David Nguyen",
        title: "Director of Health IT Procurement",
        email: "d.nguyen@health.nsw.gov.au",
        phone: "+61 2 9391 9001",
        linkedin: "https://linkedin.com/in/davidnguyen",
      },
    ],
    tech_stack: [
      { name: "Cerner Millennium", category: "EHR", maturity: "legacy" },
      { name: "Epic Systems", category: "EHR", maturity: "legacy" },
      { name: "Microsoft SQL Server", category: "Database", maturity: "legacy" },
    ],
    displacement_reasons: [
      "Multiple EHR platforms creating data silos",
      "Australian Privacy Act compliance",
      "Data residency requirements",
      "Interoperability challenges",
    ],
    renewal_date: "2027-01-31",
    annual_spend: 62000000,
  },
  "sig-006": {
    id: "sig-006",
    canonical_id: "SS-IE-DPE-2026-066",
    title: "Irish Public Sector Payroll Modernisation",
    sector: "Government",
    region: "IE",
    country: "IE",
    buyer: "Department of Public Expenditure",
    predicted_value: 28000000,
    currency: "EUR",
    confidence: 74,
    signal_tier: "HIGH_CAP",
    displacement_probability: 61,
    timeframe: "Q2 2027",
    primary_driver: "COBOL payroll system displacement",
    recommended_action: "Highlight COBOL migration de-risking case studies",
    status: "monitoring",
    source_url: "https://www.gov.ie/en/procurement/",
    source_name: "Irish Government Procurement",
    summary:
      "The Irish Department of Public Expenditure is modernising its public sector payroll system, displacing a legacy COBOL-based platform. The displacement covers payroll processing for civil servants across all government departments. EU GDPR compliance and Irish data residency are mandatory.",
    decision_makers: [
      {
        name: "Fiona O'Connor",
        title: "CIO, Department of Public Expenditure",
        email: "f.oconnor@per.gov.ie",
        phone: "+353 1 673 6000",
        linkedin: "https://linkedin.com/in/fionaconnor-per",
      },
      {
        name: "Sean Murphy",
        title: "Head of Payroll Modernisation",
        email: "s.murphy@per.gov.ie",
        phone: "+353 1 673 6001",
        linkedin: "https://linkedin.com/in/seanmurphy",
      },
    ],
    tech_stack: [
      { name: "Legacy COBOL Payroll", category: "Payroll", maturity: "legacy" },
      { name: "IBM CICS", category: "Transaction Processing", maturity: "legacy" },
      { name: "Oracle Database", category: "Database", maturity: "legacy" },
    ],
    displacement_reasons: [
      "COBOL skills shortage in Ireland",
      "Legacy system maintenance costs rising",
      "GDPR compliance requirements",
      "Irish data residency mandate",
    ],
    renewal_date: "2027-03-31",
    annual_spend: 28000000,
  },
};

const COUNTRY_LABELS: Record<string, string> = {
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
};

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  monitoring: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  validated: "text-D4AF37 bg-D4AF37/10 border-D4AF37/20",
};

const MATURITY_STYLES: Record<string, string> = {
  legacy: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  modern: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  transitioning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const signal = SIGNAL_DETAILS[id];

  if (!signal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-card p-12 text-center">
          <Target className="h-12 w-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-inter font-bold text-white mb-2">Signal Not Found</h2>
          <p className="text-slate-400 text-sm">
            The displacement intelligence for this signal is not available.
          </p>
          <Link
            href="/dashboard/signals"
            className="mt-6 inline-flex items-center gap-2 text-[10px] font-inter font-bold text-D4AF37 hover:text-white transition-colors"
          >
            Back to Signals <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 section-enter max-w-5xl min-w-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/signals"
            className="inline-flex items-center gap-2 text-[10px] font-inter font-bold text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ChevronRight className="h-3 w-3 rotate-180" /> Back to Signals
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3 w-3 text-D4AF37" />
            <span className={`text-[9px] font-inter font-bold ${STATUS_STYLES[signal.status].split(" ")[0]} uppercase tracking-tighter`}>
              {signal.displacement_probability}% displacement
            </span>
            <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[signal.status]}`}>
              {signal.status.toUpperCase()}
            </span>
          </div>
          <h1 className="text-3xl font-inter font-bold text-white tracking-tight">{signal.title}</h1>
          <p className="text-[10px] font-inter font-mono tracking-wider text-slate-400 uppercase mt-1">
            {signal.buyer} · {COUNTRY_LABELS[signal.country] || signal.country} · {signal.sector}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <a
            href={signal.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[10px] font-inter font-bold text-D4AF37 border border-D4AF37/30 hover:bg-D4AF37/5 hover:text-[#09090b] transition-all duration-300 ease-out px-4 py-2 rounded-xl"
          >
            View Source: {signal.source_name} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Key Intelligence Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-w-0">
        <MetricCard
          label="Displacement Probability"
          value={`${signal.displacement_probability}%`}
          sub="Likelihood of incumbent displacement"
          color="D4AF37"
        />
        <MetricCard
          label="Signal Confidence"
          value={`${signal.confidence}%`}
          sub="Data confidence in this signal"
          color="E5E5EA"
        />
        <MetricCard
          label="Predicted Value"
          value={
            signal.currency === "GBP"
              ? `£${signal.predicted_value.toLocaleString()}`
              : signal.currency === "EUR"
                ? `€${signal.predicted_value.toLocaleString()}`
                : `$${signal.predicted_value.toLocaleString()}`
          }
          sub="Estimated contract value"
          color="E5E5EA"
        />
      </div>

      {/* Intelligence Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-w-0">
        {/* Primary Details */}
        <div className="space-y-6">
          <IntelligenceSection
            title="Primary Driver"
            icon={Target}
            body={signal.primary_driver}
          />

          <IntelligenceSection
            title="Recommended Action"
            icon={Users}
            body={signal.recommended_action}
          />

          <IntelligenceSection
            title="Timeline & Renewal"
            icon={Clock}
            body={
              <>
                <p className="text-sm font-inter text-slate-300">
                  Signal timeframe: <span className="font-bold text-white">{signal.timeframe}</span>
                </p>
                {signal.renewal_date && (
                  <p className="text-sm font-inter text-slate-300 mt-2">
                    Contract renewal: <span className="font-bold text-white">{new Date(signal.renewal_date).toLocaleDateString("en-GB")}</span>
                  </p>
                )}
                {signal.annual_spend && (
                  <p className="text-sm font-inter text-slate-300 mt-2">
                    Annual spend:{" "}
                    <span className="font-bold text-white font-mono tabular-nums">
                      {signal.currency === "GBP" ? "£" : signal.currency === "EUR" ? "€" : "$"}{signal.annual_spend.toLocaleString()}
                    </span>
                    </p>
                )}
              </>
            }
          />

          <IntelligenceSection
            title="Summary"
            icon={Building}
            body={signal.summary}
          />
        </div>

        {/* Decision Makers & Tech Stack */}
        <div className="space-y-6">
          <IntelligenceSection
            title="Decision-Maker Contacts"
            icon={Users}
            body={
              <div className="space-y-3">
                {signal.decision_makers.map((dm) => (
                  <div key={dm.name} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                      <span className="text-[10px] font-inter font-bold text-white">
                        {dm.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-inter font-bold text-white">{dm.name}</p>
                      <p className="text-[9px] font-inter font-mono text-slate-400">
                        {dm.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {dm.email && (
                          <span className="flex items-center gap-1 text-[9px] font-inter font-mono text-slate-400">
                            <span className="h-3 w-3 text-slate-500">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            </span>
                            {dm.email}
                          </span>
                        )}
                        {dm.linkedin && (
                          <a
                            href={dm.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[9px] font-inter font-medium text-D4AF37 hover:text-D4AF37/80 transition-colors underline underline-offset-4"
                          >
                            <span className="h-3 w-3 text-D4AF37">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14C6.477 0 0 6.477 0 13v16c0 6.523 6.477 13 13 13h13c6.523 0 13-6.477 13-13V13c0-6.523-6.477-13-13-13zm-1.79 26.071H14.28v-9.16h1.88zm-3.03-8.923c-.546 0-.908-.37-.908-.852 0-.482.362-.854.908-.854.549 0 .912.372.912.854 0 .481-.363.852-.912.852zm4.635 8.923h-1.88V13.734c0-1.798-.001-3.297-2.265-3.297-2.263 0-2.563 1.486-2.563 3.223v7.74h-1.879v-16.31h1.881v2.416c1.067-.672 2.009-1.298 3.207-1.298 2.727 0 3.483 1.644 3.483 3.859v7.629z"/></svg>
                            </span>
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          />

          <IntelligenceSection
            title="Current Tech Stack"
            icon={Target}
            body={
              <div className="space-y-2">
                {signal.tech_stack.map((ts) => (
                  <div key={ts.name} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="7.5" y1="7.5" x2="16.5" y2="16.5"/></svg>
                      </span>
                      <span className="text-sm font-inter text-slate-300">{ts.name}</span>
                      <span className="text-[9px] font-inter font-mono text-slate-500 uppercase tracking-tighter">
                        {ts.category}
                      </span>
                    </div>
                    <span className={`text-[9px] font-inter font-bold px-2 py-0.5 rounded border ${MATURITY_STYLES[ts.maturity]}`}>
                      {ts.maturity}
                    </span>
                  </div>
                ))}
              </div>
            }
          />

          <IntelligenceSection
            title="Verified Displacement Reasons"
            icon={ShieldCheck}
            body={
              <ul className="space-y-2 pl-4 list-disc text-sm font-inter text-slate-300">
                {signal.displacement_reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            }
          />
        </div>
      </div>

      {/* Source Link */}
      <div className="glass-card rounded-2xl border border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-3">
          <ExternalLink className="h-4 w-4 text-D4AF37" />
          <h3 className="text-sm font-inter font-bold text-white">Source Notice</h3>
        </div>
        <p className="text-sm font-inter text-slate-400 mb-3">
          This signal was sourced from {signal.source_name}. The full procurement
          notice and supporting documentation are available at the source URL below.
        </p>
        <a
          href={signal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[10px] font-inter font-bold text-D4AF37 hover:text-D4AF37/80 transition-colors underline underline-offset-4"
        >
          Open Source Notice <ExternalLink className="h-3 w-3" />
        </a>
        <p className="text-[9px] font-inter text-slate-500 mt-2">
          Source provenance preserved for traceability and audit compliance.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl border border-slate-800 p-5">
      <p className="text-[9px] font-inter font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-2xl font-inter font-bold text-white font-mono tabular-nums text-${color === "D4AF37" ? "D4AF37" : "white"}`}>
          {value}
        </span>
      </div>
      <p className="text-[9px] font-inter text-slate-400">{sub}</p>
    </div>
  );
}

function IntelligenceSection({
  title,
  icon: Icon,
  body,
}: {
  title: string;
  icon: React.ElementType;
  body: React.ReactNode | string;
}) {
  return (
    <div className="glass-card rounded-2xl border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-D4AF37" />
        <h3 className="text-[10px] font-inter font-bold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      <div className="text-sm font-inter text-slate-300 leading-relaxed">
        {typeof body === "string" ? body : body}
      </div>
    </div>
  );
}
