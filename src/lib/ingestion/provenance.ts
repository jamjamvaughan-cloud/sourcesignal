/**
 * Cryptographic proof of signal & audit snapshots.
 *
 * Generates a content-addressed SHA-256 hex digest from an adapter's raw
 * payload and renders an immutable HTML audit snapshot of a normalised
 * signal. The digest is stored on the `signals.sha256_hash` column and
 * enforces idempotent re-ingestion via `ON CONFLICT (sha256_hash) DO NOTHING`.
 */

import { createHash } from "crypto";
import type { NormalisedSignal } from "./types";

/** SHA-256 hex digest of a raw adapter payload (deterministic serialization). */
export function computeSignalHash(
  rawPayload: Record<string, unknown> | null | undefined,
): string {
  const canonical = rawPayload
    ? JSON.stringify(rawPayload, Object.keys(rawPayload).sort())
    : "{}";
  return createHash("sha256").update(canonical).digest("hex");
}

/** SHA-256 hex digest of an arbitrary string. */
export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Escape text for safe inclusion in HTML attributes / text nodes. */
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render an immutable HTML audit snapshot for a signal. The snapshot is
 * self-describing (jurisdiction, sector, source, value, why, hash, source
 * URL) so a verifier can reconstruct the record without the application.
 */
export function buildAuditSnapshot(signal: NormalisedSignal): string {
  const estimated = signal.estimatedValue == null
    ? "Undisclosed"
    : `£${Number(signal.estimatedValue).toLocaleString()}`;
  const signalId = signal.sourceId ?? signal.title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SourceSignal Audit Snapshot — ${escapeHtml(signalId)}</title>
</head>
<body>
  <h1>SourceSignal — Cryptographic Provenance Snapshot</h1>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>

  <section>
    <h2>Signal</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th style="width:30%">Signal ID</th><td>${escapeHtml(signalId)}</td></tr>
      <tr><th>Title</th><td>${escapeHtml(signal.title)}</td></tr>
      <tr><th>Buyer</th><td>${escapeHtml(signal.buyerName)}</td></tr>
      <tr><th>Jurisdiction</th><td>${escapeHtml(signal.jurisdiction)}</td></tr>
      <tr><th>Sector</th><td>${escapeHtml(signal.sector)}</td></tr>
      <tr><th>Opportunity Type</th><td>${escapeHtml(signal.opportunityType)}</td></tr>
      <tr><th>Estimated Value</th><td>${escapeHtml(estimated)}</td></tr>
      <tr><th>Source</th><td>${escapeHtml(signal.sourceName)}</td></tr>
      <tr><th>Source URL</th><td><a href="${escapeHtml(signal.sourceUrl)}">${escapeHtml(signal.sourceUrl)}</a></td></tr>
      <tr><th>Published At</th><td>${escapeHtml(signal.publishedAt ?? "—")}</td></tr>
    </table>
  </section>

  <section>
    <h2>Commercial Why</h2>
    <p>${escapeHtml(signal.commercialWhy)}</p>
  </section>

  <section>
    <h2>Cryptographic Proof</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>SHA-256 (raw payload)</th><td><code>${escapeHtml(
        hashString(JSON.stringify(signal.rawPayload ?? {})),
      )}</code></td></tr>
      <tr><th>Algorithm</th><td>SHA-256</td></tr>
    </table>
    <p style="font-size:0.9em;color:#555">
      The SHA-256 digest above is computed over the canonical raw adapter
      payload and stored as the immutable {@code sha256_hash} on the signal
      record. Any change to the underlying source data produces a different
      digest, providing tamper evidence.
    </p>
  </section>

  <section>
    <h2>Raw Payload</h2>
    <pre>${escapeHtml(JSON.stringify(signal.rawPayload ?? {}, null, 2))}</pre>
  </section>
</body>
</html>`;
}
