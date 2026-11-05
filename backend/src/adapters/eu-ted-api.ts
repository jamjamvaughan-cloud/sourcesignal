/**
 * EU TED EU — notices search API (v3), authenticated.
 *
 * Key-authenticated requests use the same v3 endpoint as the free adapter but
 * add a Bearer token. Requires:
 *   TED_EU_API_KEY
 * https://api.ted.europa.eu/v3/notices/search
 */

import { fetchTedNoticesAllPages } from "./ted";
import type {
  IngestionOptions,
  NormalisedSignal,
  SignalSourceAdapter,
} from "./types";

export class EuTedApiAdapter implements SignalSourceAdapter {
  readonly name = "eu-ted-api";
  readonly jurisdiction = "EU" as const;
  readonly enabled = Boolean(process.env.TED_EU_API_KEY?.trim());

  async discover(options?: IngestionOptions): Promise<NormalisedSignal[]> {
    const apiKey = process.env.TED_EU_API_KEY?.trim();
    if (!apiKey) return [];
    return fetchTedNoticesAllPages(options ?? {}, apiKey);
  }
}

const euTedApiAdapter = new EuTedApiAdapter();
export default euTedApiAdapter;
