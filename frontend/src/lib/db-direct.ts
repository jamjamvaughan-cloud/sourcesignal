import { Pool } from "pg";

/**
 * Direct (non-pooled) PostgreSQL connection for serverless environments.
 *
 * Reads `DIRECT_DATABASE_URL` first (useful when you have a dedicated
 * direct-connection string alongside a pooled `DATABASE_URL`), then falls back
 * to `DATABASE_URL`. No hardcoded ports or IP addresses — managed Postgres
 * providers (Neon, Supabase, RDS, etc.) supply the full connection string.
 */
const DIRECT_DATABASE_URL =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

export const directPool = new Pool({
  connectionString: DIRECT_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Managed Postgres providers (Neon/Supabase) require SSL.
  ...(process.env.DATABASE_SSL === "true" && {
    ssl: { rejectUnauthorized: false },
  }),
});

export async function queryDirect(
  text: string,
  params?: unknown[],
): Promise<import("pg").QueryResult> {
  const start = Date.now();
  let client: import("pg").PoolClient | null = null;

  try {
    client = await directPool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn(`Slow direct query (${duration}ms): ${text.substring(0, 100)}`);
    }

    return result;
  } finally {
    if (client) client.release();
  }
}
