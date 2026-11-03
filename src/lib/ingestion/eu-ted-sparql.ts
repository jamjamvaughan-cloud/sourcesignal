/**
 * TED EU — free (anonymous) feed.
 *
 * Historically this adapter queried `https://data.ted.europa.eu/sparql`.
 * That SPARQL endpoint is retired and now returns 404, so the free feed uses
 * the supported TED v3 notices search API instead. When `TED_EU_API_KEY` is
 * present the keyed `eu-ted-api` adapter takes over to avoid duplicate rows.
 *
 * https://api.ted.europa.eu/v3/notices/search
 */

import { fetchTedNotices } from "./ted";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalSourceAdapter,
} from "./types";

export class EuTedSparqlAdapter implements SignalSourceAdapter {
  readonly name = "eu-ted-sparql";
  readonly jurisdiction = "EU" as const;
  readonly enabled = !process.env.TED_EU_API_KEY?.trim();

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    return fetchTedNotices(options);
  }
}

const euTedSparqlAdapter = new EuTedSparqlAdapter();
export default euTedSparqlAdapter;
