/**
 * Source adapter registry.
 *
 * Registers all available source adapters. To add a new adapter, import it
 * here and add it to the ADAPTERS array.
 *
 * Architecture: 24 feeds total across 6 jurisdictions:
 *   UK:   contracts_finder, find_a_tender, scotland_pcs, scotland_pcs_tender,
 *         scotland_scottish_water, uk_mod_dsp
 *   US:   sam_gov, us_usaspending, us_dla_dibbs, us_caleprocure
 *   CA:   canada_buys, canada_merx, canada_provincial
 *   IE:   ireland_etenders, ireland_ogp, ireland_esb_tii, ireland_irish_water
 *   AU:   au_austender, au_state_procurement, au_defence
 *   EU:   eu_ted, eu_eprocurement, eu_eda
 */
import { UkContractsFinderAdapter } from "@/adapters/uk_contracts_finder";
import { UkFindATenderAdapter } from "@/adapters/uk_find_a_tender";
import { ScotlandPCSAdapter } from "@/adapters/scotland_pcs";
import { ScotlandPCSTenderAdapter } from "@/adapters/scotland_pcs_tender";
import { ScotlandScottishWaterAdapter } from "@/adapters/scotland_scottish_water";
import { UkModDspAdapter } from "@/adapters/uk_mod_dsp";
import { USSamGovAdapter } from "@/adapters/us_sam_gov";
import { USASpendingAdapter } from "@/adapters/us_usaspending";
import { DLADIBBSAdapter } from "@/adapters/us_dla_dibbs";
import { USCalProcureAdapter } from "@/adapters/us_caleprocure";
import { CanadaBuysAdapter } from "@/adapters/canada_buys";
import { CanadaMerxAdapter } from "@/adapters/canada_merx";
import { CanadaProvincialAdapter } from "@/adapters/canada_provincial";
import { IrelandETendersAdapter } from "@/adapters/ireland_etenders";
import { IrelandOGPAdapter } from "@/adapters/ireland_ogp";
import { IrelandESBTIIAdapter } from "@/adapters/ireland_esb_tii";
import { IrelandIrishWaterAdapter } from "@/adapters/ireland_irish_water";
import { AusTenderAdapter } from "@/adapters/au_austender";
import { AUStateProcurementAdapter } from "@/adapters/au_state_procurement";
import { AUDefenceAdapter } from "@/adapters/au_defence";
import { EUTEDAdapter } from "@/adapters/eu_ted";
import { EUeProcurementAdapter } from "@/adapters/eu_eprocurement";
import { EUEDAAdapter } from "@/adapters/eu_eda";
import type { SourceAdapter } from "@/types";

export const ADAPTERS: readonly SourceAdapter[] = [
  // United Kingdom (6)
  new UkContractsFinderAdapter(),
  new UkFindATenderAdapter(),
  new ScotlandPCSAdapter(),
  new ScotlandPCSTenderAdapter(),
  new ScotlandScottishWaterAdapter(),
  new UkModDspAdapter(),

  // United States (4)
  new USSamGovAdapter(),
  new USASpendingAdapter(),
  new DLADIBBSAdapter(),
  new USCalProcureAdapter(),

  // Canada (3)
  new CanadaBuysAdapter(),
  new CanadaMerxAdapter(),
  new CanadaProvincialAdapter(),

  // Ireland (4)
  new IrelandETendersAdapter(),
  new IrelandOGPAdapter(),
  new IrelandESBTIIAdapter(),
  new IrelandIrishWaterAdapter(),

  // Australia (3)
  new AusTenderAdapter(),
  new AUStateProcurementAdapter(),
  new AUDefenceAdapter(),

  // European Union (3)
  new EUTEDAdapter(),
  new EUeProcurementAdapter(),
  new EUEDAAdapter(),
];

/**
 * Returns all enabled adapters.
 */
export function getEnabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.enabled);
}

/**
 * Returns an adapter by name.
 */
export function getAdapterByName(name: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.name === name);
}

/**
 * Returns adapters grouped by country/jurisdiction.
 */
export function getAdaptersByCountry(): Record<string, SourceAdapter[]> {
  const countryMap: Record<string, string[]> = {
    uk: [
      "uk_contracts_finder",
      "uk_find_a_tender",
      "scotland_pcs",
      "scotland_pcs_tender",
      "scotland_scottish_water",
      "uk_mod_dsp",
    ],
    us: ["us_sam_gov", "us_usaspending", "us_dla_dibbs", "us_caleprocure"],
    ca: ["canada_buys", "canada_merx", "canada_provincial"],
    ie: [
      "ireland_etenders",
      "ireland_ogp",
      "ireland_esb_tii",
      "ireland_irish_water",
    ],
    au: ["au_austender", "au_state_procurement", "au_defence"],
    eu: ["eu_ted", "eu_eprocurement", "eu_eda"],
  };

  const result: Record<string, SourceAdapter[]> = {};
  for (const [country, names] of Object.entries(countryMap)) {
    result[country] = names
      .map((n) => getAdapterByName(n))
      .filter((a): a is SourceAdapter => a != null);
  }
  return result;
}
