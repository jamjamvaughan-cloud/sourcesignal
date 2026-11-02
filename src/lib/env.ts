/**
 * Environment configuration for SourceSignal.
 *
 * PostgreSQL is the backend. Redis is optional; when `REDIS_URL` is absent the
 * cache/session layer falls back to PostgreSQL or in-process memory (see
 * `@/lib/redis`).
 *
 * Additional server-only credentials:
 *   JWT_SECRET               — session token signing secret
 *   STRIPE_SECRET_KEY        — Stripe secret key (server only)
 *   STRIPE_WEBHOOK_SECRET    — Stripe webhook signing secret (server only)
 *   STRIPE_PRICE_ID_PRO      — Stripe price ID for the Pro plan (server only)
 *   NVIDIA_API_KEY           — NVIDIA API key for extraction (server only)
 *   NVIDIA_API_BASE_URL      — NVIDIA API endpoint (server only)
 *   NVIDIA_MODEL             — NVIDIA model identifier (server only)
 *   WEBHOOK_SIGNING_SECRET   — HMAC-SHA256 signing secret for webhook dispatch
 *
 * Validation is intentionally opt-in (call `validateServerEnv()` from a
 * server-side entry point) so the landing page can render without every
 * optional integration configured.
 */

export interface SourceSignalEnv {
  /** PostgreSQL connection string. Server only. */
  readonly databaseUrl: string;
  /** Optional Redis URL. Null when Redis is disabled. */
  readonly redisUrl: string | null;
  /** Session token signing secret. Server only. */
  readonly jwtSecret: string | null;
  /** Stripe secret key. Server only. */
  readonly stripeSecretKey: string | null;
  /** Stripe webhook signing secret. Server only. */
  readonly stripeWebhookSecret: string | null;
  /** Stripe price ID for the Pro plan. Server only. */
  readonly stripePriceIdPro: string | null;
  /** NVIDIA API key. Server only. */
  readonly nvidiaApiKey: string | null;
  /** NVIDIA API base URL. Server only. */
  readonly nvidiaApiBaseUrl: string | null;
  /** NVIDIA model identifier. Server only. */
  readonly nvidiaModel: string | null;
  /** Webhook signing secret. Server only. */
  readonly webhookSigningSecret: string | null;
}

/** Names of server-only environment variables that must never reach the client. */
export const SERVER_ONLY_ENV_KEYS = [
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

/**
 * Production-required environment variables. Redis is intentionally excluded
 * because the cache layer has a PostgreSQL/memory fallback.
 */
export const PRODUCTION_ENV_KEYS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_PRO",
  "NVIDIA_API_KEY",
  "NVIDIA_API_BASE_URL",
  "NVIDIA_MODEL",
  "WEBHOOK_SIGNING_SECRET",
] as const;

/**
 * Returns the PostgreSQL connection string. Throws a clear, actionable error
 * when the variable is missing or malformed.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Set it in .env (see .env.example) before " +
        "starting the application.",
    );
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      "DATABASE_URL must start with 'postgres://' or 'postgresql://'.",
    );
  }
  return url;
}

/** Returns the optional Redis URL, or null when Redis is disabled. */
export function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

/** Returns the session signing secret, or null when unset. */
export function getJwtSecret(): string | null {
  return process.env.JWT_SECRET?.trim() || null;
}

/**
 * Returns Stripe configuration. Any missing value returns null; callers must
 * handle the unconfigured state (paid access stays locked).
 */
export function getStripeConfig(): {
  secretKey: string | null;
  webhookSecret: string | null;
  priceIdPro: string | null;
} {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY ?? null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    priceIdPro: process.env.STRIPE_PRICE_ID_PRO ?? null,
  };
}

/**
 * Returns NVIDIA API configuration. Any missing value returns null.
 */
export function getNvidiaConfig(): {
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
} {
  return {
    apiKey: process.env.NVIDIA_API_KEY ?? null,
    baseUrl: process.env.NVIDIA_API_BASE_URL ?? null,
    model: process.env.NVIDIA_MODEL ?? null,
  };
}

/**
 * Validates the minimum server configuration needed to boot. In production,
 * `JWT_SECRET` is also required so sessions cannot be signed with the
 * development fallback.
 */
export function validateServerEnv(): void {
  getDatabaseUrl();

  if (process.env.NODE_ENV === "production" && !getJwtSecret()) {
    throw new Error(
      "Missing required server environment variable: JWT_SECRET",
    );
  }
}

/**
 * Validates that all production environment variables are present.
 * Call this from a server-side entry point at startup to ensure production
 * readiness. Throws a clear, actionable error listing every missing key.
 */
export function validateProductionEnv(): void {
  const missing: string[] = [];
  for (const key of PRODUCTION_ENV_KEYS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(
        ", ",
      )}.\n` +
        "Set these in your .env file (see .env.example) before starting the " +
        "application in production.",
    );
  }

  getDatabaseUrl();

  const stripeConfig = getStripeConfig();
  if (
    stripeConfig.secretKey &&
    !/^sk_(live|test)_/.test(stripeConfig.secretKey)
  ) {
    throw new Error(
      "STRIPE_SECRET_KEY must start with 'sk_live_' or 'sk_test_'.",
    );
  }

  const nvidiaConfig = getNvidiaConfig();
  if (nvidiaConfig.apiKey && !/^nvapi-/.test(nvidiaConfig.apiKey)) {
    throw new Error("NVIDIA_API_KEY must start with 'nvapi-'.");
  }
}

/**
 * Returns a validation report of all production environment variables,
 * indicating which are configured and which are missing.
 * Does not throw — useful for health checks and startup diagnostics.
 */
export function getEnvValidationReport(): {
  valid: boolean;
  missing: string[];
  configured: string[];
} {
  const missing: string[] = [];
  const configured: string[] = [];
  for (const key of PRODUCTION_ENV_KEYS) {
    if (process.env[key]) {
      configured.push(key);
    } else {
      missing.push(key);
    }
  }
  return {
    valid: missing.length === 0,
    missing,
    configured,
  };
}

/** Lazy, memoised access to validated env. */
let _env: SourceSignalEnv | null = null;
export function getEnv(): SourceSignalEnv {
  if (_env) return _env;
  _env = {
    databaseUrl: getDatabaseUrl(),
    redisUrl: getRedisUrl(),
    jwtSecret: getJwtSecret(),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? null,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO ?? null,
    nvidiaApiKey: process.env.NVIDIA_API_KEY ?? null,
    nvidiaApiBaseUrl: process.env.NVIDIA_API_BASE_URL ?? null,
    nvidiaModel: process.env.NVIDIA_MODEL ?? null,
    webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET ?? null,
  };
  return _env;
}
