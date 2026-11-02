/**
 * Minimal `.env` loader for standalone scripts run with `tsx`.
 *
 * Next.js loads `.env*` automatically for the application, but `tsx` scripts
 * run outside that runtime. This helper mirrors Next.js precedence for local
 * development:
 *
 *   shell environment > .env.local > .env
 *
 * Existing variables are never overwritten, so an inline override such as
 *
 *   DATABASE_URL=... npx tsx scripts/reset-db.ts
 *
 * always wins.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Files loaded in precedence order (highest priority first). */
const ENV_FILES = [".env.local", ".env"] as const;

function parseEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equals = line.indexOf("=");
    if (equals === -1) continue;

    const key = line.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(equals + 1).trim();
    // Strip matching single/double quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Expand simple ${VAR} references from already-known values.
    value = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
      return process.env[name] ?? values[name] ?? "";
    });

    values[key] = value;
  }

  return values;
}

/** Loads `.env.local` then `.env` into `process.env` without overwriting. */
export function loadEnvFiles(cwd: string = process.cwd()): void {
  for (const file of ENV_FILES) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;

    const parsed = parseEnv(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

// Auto-run on import so `import "./load-env";` is sufficient.
loadEnvFiles();
