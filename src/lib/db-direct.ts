import { Pool } from "pg";

const DIRECT_DATABASE_URL = process.env.DATABASE_URL?.replace(
  /:6432\//,
  ":5432/",
);

export const directPool = new Pool({
  connectionString: DIRECT_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
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
