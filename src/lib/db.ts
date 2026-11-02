/**
 * PostgreSQL connection pool (native `pg`, optional PgBouncer in front).
 *
 * The pool is created lazily on first use rather than at module import time.
 * This is important for two reasons:
 *
 *   1. A missing `DATABASE_URL` no longer crashes the whole Next.js server on
 *      import. API routes can catch the error and return an actionable 503
 *      response instead of an opaque 500.
 *   2. Scripts can load `.env` / `.env.local` (see `scripts/load-env.ts`)
 *      before the first query without relying on import-order side effects.
 *
 * Every database operation should go through the exported `query()` helper
 * (or `withTransaction()` for multi-statement transactions) so parameterised
 * queries, error logging and client release are handled consistently.
 */

import { Pool, type PoolClient, type QueryResult } from "pg";
import { error, warn } from "@/lib/logger";

export type { PoolClient };

/** Thrown when the database is not configured or unreachable. */
export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

let poolInstance: Pool | null = null;

/** Returns true when `DATABASE_URL` is present and looks like PostgreSQL. */
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && /^postgres(ql)?:\/\//.test(url));
}

/**
 * Resolves and validates the PostgreSQL connection string.
 *
 * @throws {DatabaseUnavailableError} with an actionable message when missing
 *   or malformed, so API routes can surface a clear configuration error.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new DatabaseUnavailableError(
      "Missing DATABASE_URL environment variable. Add it to .env (see " +
        ".env.example) and restart the server.",
    );
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new DatabaseUnavailableError(
      "DATABASE_URL must start with 'postgres://' or 'postgresql://'.",
    );
  }
  return url;
}

/**
 * Returns the process-wide pool, creating it on first call.
 *
 * max: 20 clients per Node process (PgBouncer multiplexes across instances).
 * idleTimeoutMillis: close idle clients after 30 seconds.
 * connectionTimeoutMillis: fail fast (10s) when PostgreSQL is unreachable.
 */
export function getPool(): Pool {
  if (poolInstance) return poolInstance;

  const connectionString = getDatabaseUrl();
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Keep TCP sockets alive through Docker/OS NAT timeouts.
    keepAlive: true,
  });

  // An idle client can emit an error (e.g. PostgreSQL restart). Without a
  // listener Node treats it as an unhandled event and crashes the process.
  pool.on("error", (err) => {
    error("db", {
      message: "Unexpected idle PostgreSQL client error",
      error: err instanceof Error ? err.message : String(err),
    });
  });

  poolInstance = pool;
  return pool;
}

/**
 * Backwards-compatible lazy pool proxy. Existing scripts call
 * `pool.connect()` / `pool.end()` directly; those calls transparently create
 * and dispose the underlying pool.
 */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, property) {
    const instance = getPool();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/** Formats an unknown thrown value for structured logging. */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  return String(err);
}

/**
 * Executes a parameterised SQL query through the pooled connection.
 *
 * @param text   SQL query string with $1, $2, ... placeholders.
 * @param params Optional array of parameter values.
 * @returns The pg QueryResult.
 *
 * @throws If the query fails after acquiring a client from the pool.
 */
export async function query(
  text: string,
  params?: unknown[],
): Promise<QueryResult> {
  const start = Date.now();
  let client: PoolClient | null = null;

  try {
    client = await getPool().connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>1s) for observability.
    if (duration > 1000) {
      warn("db", {
        message: `Slow query (${duration}ms)`,
        query: text.slice(0, 160),
      });
    }

    return result;
  } catch (err: unknown) {
    error("db", {
      message: "Query failed",
      error: formatError(err),
      query: text.slice(0, 200),
    });
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Returns a pooled client for multi-statement transactions.
 *
 * Callers must call `client.release()` when done, typically in a `finally`
 * block. Prefer `withTransaction()` which guarantees BEGIN/COMMIT/ROLLBACK.
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Runs `fn` inside a database transaction, committing on success and rolling
 * back on any thrown error. The client is always released.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      error("db", {
        message: "Rollback failed",
        error: formatError(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gracefully closes the pool. Call this during process shutdown (e.g.
 * Next.js serverless teardown or worker SIGTERM).
 */
export async function closePool(): Promise<void> {
  const instance = poolInstance;
  poolInstance = null;
  if (instance) {
    await instance.end();
  }
}

/**
 * Health-check the database connection. Returns true if a simple
 * `SELECT 1` succeeds. Never throws.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
