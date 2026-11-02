/**
 * PostgreSQL connection pool (hyper-scale backend).
 *
 * Initializes a global `pg.Pool` connected through PgBouncer (transaction mode)
 * using `process.env.DATABASE_URL`. Configured with conservative pool limits
 * suitable for Next.js serverless / long-running worker processes.
 *
 * Every database operation should go through the exported `query()` helper
 * to ensure consistent parameterized query handling and error logging.
 */

import { Pool, type PoolClient, type QueryResult } from "pg";

export type { PoolClient };

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL environment variable. " +
      "Set it in .env (see .env.example) before starting the application.",
  );
}

/**
 * Global PostgreSQL connection pool.
 *
 * max: 20 clients per Node process (PgBouncer handles multiplexing across
 * thousands of client connections on the server side).
 * idleTimeoutMs: 30s — close idle clients after 30 seconds of inactivity.
 * connectionTimeoutMs: 15s — fail fast when PgBouncer is unreachable.
 */
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

/**
 * Executes a parameterized SQL query through the pooled connection.
 *
 * @param text   SQL query string with $1, $2, ... parameter placeholders.
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
    client = await pool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>1s) for observability.
    if (duration > 1000) {
      console.warn(
        `[db] Slow query (${duration}ms): ${text.slice(0, 120)}`,
      );
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[db] Query error: ${message}\n  ${text.slice(0, 200)}`,
    );
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
 * block. Use this only when you need `BEGIN` / `COMMIT` / `ROLLBACK` control.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Gracefully closes the pool. Call this during process shutdown (e.g.
 * Next.js serverless teardown or worker SIGTERM).
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

/**
 * Health-check the database connection. Returns true if a simple
 * `SELECT 1` succeeds.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
