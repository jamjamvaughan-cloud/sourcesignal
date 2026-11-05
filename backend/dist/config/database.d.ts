/**
 * SourceSignal — Database & Redis configuration.
 *
 * Stateless design: all runtime state (sessions, rate-limit counters, job
 * queues) lives in Redis; all durable data lives in PostgreSQL via PgBouncer
 * in transaction mode. The pg Pool and ioredis client are process-wide
 * singletons created lazily on first use so imports never crash when env is
 * missing (API routes / workers can surface a clear 503 instead).
 *
 * Every database operation goes through the exported `query()` helper so
 * parameterised queries, error logging, slow-query detection, and client
 * release are handled consistently.
 */
import { Pool, type PoolClient, type QueryResult } from "pg";
import IORedis from "ioredis";
export type { PoolClient };
/** Thrown when the database or Redis is not configured / unreachable. */
export declare class BackendUnavailableError extends Error {
    readonly code = "BACKEND_UNAVAILABLE";
    constructor(message: string);
}
/** True when DATABASE_URL is present and looks like PostgreSQL. */
export declare function isDatabaseConfigured(): boolean;
/** Resolves and validates the PostgreSQL connection string (PgBouncer URI). */
export declare function getDatabaseUrl(): string;
/** Returns the process-wide pool, creating it on first call. */
export declare function getPool(): Pool;
/** Backwards-compatible lazy pool proxy (pool.connect() / pool.end() etc.). */
export declare const pool: Pool;
/**
 * Executes a parameterised SQL query through the pooled connection.
 *
 * @param text   SQL query with $1, $2, ... placeholders (pg / PgBouncer).
 * @param params Optional parameter values.
 * @returns The pg QueryResult.
 */
export declare function query(text: string, params?: unknown[]): Promise<QueryResult>;
/** Returns a pooled client for multi-statement transactions. */
export declare function getClient(): Promise<PoolClient>;
/**
 * Runs `fn` inside a database transaction (BEGIN/COMMIT/ROLLBACK). The client
 * is always released.
 */
export declare function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
/** Gracefully closes the pool. Call during process shutdown (SIGTERM). */
export declare function closePool(): Promise<void>;
/** Health-check the database connection. Returns true if `SELECT 1` succeeds. */
export declare function dbHealthCheck(): Promise<boolean>;
/** Returns the process-wide Redis client, creating it on first call. */
export declare function getRedis(): IORedis;
/** Backwards-compatible lazy Redis proxy. */
export declare const redis: IORedis;
/** Health-check Redis. Returns true if `PING` succeeds. Never throws. */
export declare function redisHealthCheck(): Promise<boolean>;
/** Gracefully closes Redis. Call during process shutdown (SIGTERM). */
export declare function closeRedis(): Promise<void>;
/** Closes both the PostgreSQL pool and Redis client. */
export declare function closeConnections(): Promise<void>;
//# sourceMappingURL=database.d.ts.map