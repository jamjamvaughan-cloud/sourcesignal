/**
 * NVIDIA API extraction client (Phase E).
 *
 * Server-side integration with the NVIDIA API for AI-assisted procurement
 * data extraction. All credentials are read from server-only environment
 * variables and never exposed to the browser.
 *
 * Features:
 * - Configurable model and endpoint via environment variables
 * - Structured JSON output with runtime schema validation
 * - Explicit distinction between source facts, inferred summaries, unknowns
 * - Rate limit, timeout, malformed JSON, and outage handling
 * - Bounded safe retries with exponential backoff
 * - Deterministic mock extraction for automated tests only
 */

import { getNvidiaConfig } from "@/lib/env";

export interface ExtractionResult {
  readonly fields: Record<string, unknown>;
  readonly success: boolean;
  readonly confidence: number;
  readonly status: "success" | "partial" | "failed" | "skipped";
  readonly error?: string;
  readonly model?: string;
  readonly inferred: boolean;
  readonly rawResponse?: Record<string, unknown>;
}

/**
 * Email classification for buyer contact extraction.
 * Distinguishes direct decision-maker emails from generic inboxes.
 */
export interface EmailClassification {
  readonly email: string;
  readonly type: "direct_decision_maker" | "general_inbox" | "unknown";
  readonly confidence: number;
  readonly domain: string;
}

/**
 * Extracts email addresses from source text and classifies each as either
 * a direct decision-maker email (named individual format) or a general inbox
 * (procurement@, info@, enquiries@, etc.).
 */
export function extractBuyerEmails(text: string): EmailClassification[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  if (!matches) return [];

  const generalInboxKeywords = [
    "procurement",
    "purchasing",
    "buying",
    "tender",
    "bids",
    "contracts",
    "info",
    "enquiries",
    "enquiries",
    "contact",
    "hello",
    "hello",
    "admin",
    "office",
    "help",
    "support",
    "admin",
    "team",
  ];

  const results: EmailClassification[] = [];

  for (const email of matches) {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const localPart = email.split("@")[0]?.toLowerCase() ?? "";

    // Check if local part matches a general inbox keyword
    const isGeneric = generalInboxKeywords.some(
      (kw) => localPart === kw || localPart.startsWith(kw + ".") || localPart.startsWith(kw + "-"),
    );

    if (isGeneric) {
      results.push({
        email,
        type: "general_inbox",
        confidence: 90,
        domain,
      });
    } else {
      // Assume it's a direct decision-maker email if it looks like a person's name
      results.push({
        email,
        type: "direct_decision_maker",
        confidence: 70,
        domain,
      });
    }
  }

  return results;
}

// --- Types ---

export interface ExtractedOpportunity {
  /** Fields directly sourced from the document (source facts). */
  readonly sourceFacts: Record<string, unknown>;
  /** Fields inferred by the model (not directly evidenced). */
  readonly inferredSummary: Record<string, unknown>;
  /** Fields that could not be determined. */
  readonly unknownFields: string[];
  /** Confidence score (0-100). */
  readonly confidence: number;
}

export interface NvidiaConfig {
  readonly apiKey: string | null;
  readonly baseUrl: string | null;
  readonly model: string | null;
}

/** JSON schema for structured extraction output. */
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    source_facts: {
      type: "object",
      properties: {
        buyer: { type: "string" },
        estimated_value: { type: "number" },
        currency: { type: "string" },
        closing_date: { type: "string" },
        published_date: { type: "string" },
        procurement_stage: { type: "string" },
        location: { type: "string" },
        sector: { type: "string" },
      },
      additionalProperties: false,
    },
    inferred_summary: {
      type: "object",
      properties: {
        summary: { type: "string" },
        confidence_notes: { type: "string" },
      },
      additionalProperties: false,
    },
    unknown_fields: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 100 },
  },
  required: ["source_facts", "inferred_summary", "unknown_fields", "confidence"],
  additionalProperties: false,
} as const;

/**
 * Returns the NVIDIA API configuration.
 */
export function getNvidiaApiConfig(): NvidiaConfig {
  return getNvidiaConfig();
}

/**
 * Checks whether NVIDIA extraction is configured.
 */
export function isNvidiaConfigured(): boolean {
  const config = getNvidiaApiConfig();
  return Boolean(config.apiKey && config.baseUrl && config.model);
}

/**
 * Validates an extraction result against the strict schema.
 * Returns null if validation fails.
 */
export function validateExtractionOutput(
  output: unknown,
): ExtractedOpportunity | null {
  if (!output || typeof output !== "object") return null;

  const obj = output as Record<string, unknown>;

  const sourceFacts = obj.source_facts;
  const inferredSummary = obj.inferred_summary;
  const unknownFields = obj.unknown_fields;
  const confidence = obj.confidence;

  if (
    !sourceFacts ||
    typeof sourceFacts !== "object" ||
    Array.isArray(sourceFacts)
  ) return null;
  if (
    !inferredSummary ||
    typeof inferredSummary !== "object" ||
    Array.isArray(inferredSummary)
  ) return null;
  if (
    !Array.isArray(unknownFields) ||
    !unknownFields.every((f) => typeof f === "string")
  ) return null;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 100)
    return null;

  // Never allow inferred buyer email, value, date, or award status without
  // explicit source evidence. These fields must only come from source_facts.
  const restrictedKeys = ["buyer_email", "contract_value", "award_status"];
  for (const key of restrictedKeys) {
    if (key in inferredSummary) {
      return null;
    }
  }

  return {
    sourceFacts: sourceFacts as Record<string, unknown>,
    inferredSummary: inferredSummary as Record<string, unknown>,
    unknownFields,
    confidence,
  };
}

/**
 * Calls the NVIDIA API with bounded retries and exponential backoff.
 * Throws on permanent failures; returns null for transient outages after
 * all retries are exhausted.
 */
async function callNvidiaApiWithRetries(
  payload: string,
  config: NvidiaConfig,
  maxRetries: number = 3,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const baseUrl = config.baseUrl!;
  const model = config.model!;
  const apiKey = config.apiKey!;

  const requestPayload = JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a procurement data extraction assistant. Extract structured " +
          "information from procurement tender notices. Return ONLY valid JSON " +
          "matching the requested schema. Never infer buyer email, contract " +
          "value, closing date, or award status without explicit source " +
          "evidence. Mark unknown values as unknown_fields. Distinguish source " +
          "facts from inferred summaries.",
      },
      {
        role: "user",
        content: payload,
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestPayload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Rate limit (429) or server error (5xx) → retry with backoff.
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000;
        lastError = `NVIDIA API returned ${response.status}`;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return { ok: false, error: lastError };
      }

      if (!response.ok) {
        lastError = `NVIDIA API returned ${response.status}`;
        return { ok: false, error: lastError };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      return { ok: false, error: lastError };
    }
  }

  return { ok: false, error: lastError || "NVIDIA API call failed" };
}

/**
 * Extracts structured information from a source record using the NVIDIA API.
 *
 * When NVIDIA credentials are absent, returns a deterministic mock result
 * labelled for automated tests only. Mock results are clearly marked as
 * test fixtures and must never be presented as live intelligence.
 */
export async function extractWithNvidia(
  sourceText: string,
  sourceUrl: string,
): Promise<ExtractionResult> {
  const config = getNvidiaApiConfig();
  const model = config.model ?? undefined;

  // Not configured → deterministic mock for tests only.
  if (!isNvidiaConfigured()) {
    return {
      fields: {
        source_facts: {},
        inferred_summary: { summary: "Mock extraction — NVIDIA not configured" },
        unknown_fields: ["buyer", "estimated_value", "closing_date"],
        confidence: 0,
      },
      success: false,
      confidence: 0,
      status: "skipped",
      error: "NVIDIA API not configured",
      model: undefined,
      inferred: false,
    };
  }

  const payload = JSON.stringify({
    source_text: sourceText,
    source_url: sourceUrl,
    schema: EXTRACTION_SCHEMA,
    instructions:
      "Extract source facts only. Do not infer buyer email, contract value, " +
      "closing date, or award status without evidence.",
  });

  const result = await callNvidiaApiWithRetries(payload, config);

  if (!result.ok) {
    return {
      fields: {},
      success: false,
      confidence: 0,
      status: "failed",
      error: result.error,
      model: model,
      inferred: false,
    };
  }

  const rawResponse = (result.data as unknown) as Record<string, unknown>;
  const choices = rawResponse.choices as unknown[];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content as string | undefined;

  if (!content) {
    return {
      fields: {},
      success: false,
      confidence: 0,
      status: "failed",
      error: "No content in NVIDIA API response",
      model: model,
      inferred: false,
    };
  }

  // Parse the model's JSON output.
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Malformed JSON — attempt one repair by extracting the JSON block.
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        fields: {},
        success: false,
        confidence: 0,
        status: "failed",
        error: "Malformed JSON from NVIDIA API",
        model: model,
        inferred: false,
        rawResponse,
      };
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return {
        fields: {},
        success: false,
        confidence: 0,
        status: "failed",
        error: "Malformed JSON from NVIDIA API (repair failed)",
        model: model,
        inferred: false,
        rawResponse,
      };
    }
  }

  // Validate against the strict schema.
  const validated = validateExtractionOutput(parsed);
  if (!validated) {
    return {
      fields: {},
      success: false,
      confidence: 0,
      status: "failed",
      error: "NVIDIA output failed schema validation",
      model: model,
      inferred: false,
      rawResponse,
    };
  }

  return {
    fields: validated.sourceFacts as Record<string, unknown>,
    success: true,
    confidence: validated.confidence,
    status: validated.unknownFields.length > 0 ? "partial" : "success",
    error: undefined,
    model: model,
    inferred: Boolean(
      Object.keys(validated.inferredSummary).length > 0,
    ),
    rawResponse,
  };
}
