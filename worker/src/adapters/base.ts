/**
 * Base source adapter class.
 *
 * Source adapters discover records from permitted public procurement sources.
 * Each adapter implements the `discover()` method and optionally
 * `fetchEvidence()` for preserving source snapshots.
 *
 * To add a new adapter:
 * 1. Create a new file in src/adapters/ extending SourceAdapter.
 * 2. Implement discover() and optionally fetchEvidence().
 * 3. Register the adapter in src/pipeline/registry.ts.
 * 4. Never bypass authentication, CAPTCHAs, or access controls.
 */

import type { SourceAdapter, SourceRecord } from "@/types";

export abstract class BaseSourceAdapter implements SourceAdapter {
  readonly name: string;
  readonly enabled: boolean;

  constructor(name: string, enabled: boolean = true) {
    this.name = name;
    this.enabled = enabled;
  }

  abstract discover(): Promise<SourceRecord[]>;

  fetchEvidence?(_record: SourceRecord): Promise<SourceRecord> {
    return Promise.resolve(_record);
  }
}
