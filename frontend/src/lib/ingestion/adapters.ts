/**
 * Registry of primary-source ingestion adapters.
 *
 * Free sources are always enabled. Key-authenticated adapters self-disable
 * when their environment variable is absent so a missing key never blocks a
 * cycle or produces noisy 401s.
 */

import type { SignalSourceAdapter } from "./types";
import ukTenders from "./uk-tenders";
import ukPlanning from "./uk-planning";
import usSpending from "./us-spending";
import usSec from "./us-sec";
import euTedSparql from "./eu-ted-sparql";
import euOpenData from "./eu-opendata";
import ukCompaniesHouse from "./uk-companies-house";
import usSam from "./us-sam";
import euTedApi from "./eu-ted-api";

export const SIGNAL_ADAPTERS: readonly SignalSourceAdapter[] = [
  ukTenders,
  ukPlanning,
  ukCompaniesHouse,
  usSpending,
  usSam,
  usSec,
  euTedSparql,
  euTedApi,
  euOpenData,
];

export function getEnabledSignalAdapters(): SignalSourceAdapter[] {
  return SIGNAL_ADAPTERS.filter((adapter) => adapter.enabled);
}
