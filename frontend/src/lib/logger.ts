/**
 * Structured logging utility (Phase J).
 *
 * Provides consistent JSON-structured log output for the web application and
 * ingestion worker. Logs never include credentials, API keys, or unnecessary
 * personal data.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly service: string;
  readonly [key: string]: unknown;
}

/**
 * Sanitizes an object by removing known sensitive keys before logging.
 */
function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const sensitiveKeys = new Set([
      "password", "api_key", "apikey", "secret", "token", "authorization",
      "stripe_secret_key", "stripe_webhook_secret", "nvidia_api_key",
    ]);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveKeys.has(k.toLowerCase())) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitize(v);
      }
    }
    return result;
  }
  return obj;
}

const SERVICE_NAME = process.env.SERVICE_NAME ?? "sourcesignal";

/**
 * Writes a structured JSON log line to stdout.
 */
export function log(
  level: LogLevel,
  message: string,
  meta: Record<string, unknown> = {},
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    ...(sanitize(meta) as Record<string, unknown>),
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export function debug(message: string, meta?: Record<string, unknown>): void {
  log("debug", message, meta);
}

export function info(message: string, meta?: Record<string, unknown>): void {
  log("info", message, meta);
}

export function warn(message: string, meta?: Record<string, unknown>): void {
  log("warn", message, meta);
}

export function error(message: string, meta?: Record<string, unknown>): void {
  log("error", message, meta);
}
