"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.pool = exports.BackendUnavailableError = void 0;
exports.isDatabaseConfigured = isDatabaseConfigured;
exports.getDatabaseUrl = getDatabaseUrl;
exports.getPool = getPool;
exports.query = query;
exports.getClient = getClient;
exports.withTransaction = withTransaction;
exports.closePool = closePool;
exports.dbHealthCheck = dbHealthCheck;
exports.getRedis = getRedis;
exports.redisHealthCheck = redisHealthCheck;
exports.closeRedis = closeRedis;
exports.closeConnections = closeConnections;
const pg_1 = require("pg");
const ioredis_1 = __importDefault(require("ioredis"));
/** Thrown when the database or Redis is not configured / unreachable. */
class BackendUnavailableError extends Error {
    code = "BACKEND_UNAVAILABLE";
    constructor(message) {
        super(message);
        this.name = "BackendUnavailableError";
    }
}
exports.BackendUnavailableError = BackendUnavailableError;
/* ------------------------------------------------------------------ */
/* PostgreSQL (via PgBouncer)                                         */
/* ------------------------------------------------------------------ */
let poolInstance = null;
/** True when DATABASE_URL is present and looks like PostgreSQL. */
function isDatabaseConfigured() {
    const url = process.env.DATABASE_URL?.trim();
    return Boolean(url && /^postgres(ql)?:\/\//.test(url));
}
/** Resolves and validates the PostgreSQL connection string (PgBouncer URI). */
function getDatabaseUrl() {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
        throw new BackendUnavailableError("Missing DATABASE_URL. Add it to .env (see .env.example) and restart.");
    }
    if (!/^postgres(ql)?:\/\//.test(url)) {
        throw new BackendUnavailableError("DATABASE_URL must start with 'postgres://' or 'postgresql://'.");
    }
    return url;
}
/** Returns the process-wide pool, creating it on first call. */
function getPool() {
    if (poolInstance)
        return poolInstance;
    const connectionString = getDatabaseUrl();
    const pool = new pg_1.Pool({
        connectionString,
        // PgBouncer multiplexes server connections; keep the per-process client
        // pool modest so many API replicas share the DB fairly.
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        keepAlive: true,
        ...(process.env.DATABASE_SSL === "true" && {
            ssl: { rejectUnauthorized: false },
        }),
    });
    pool.on("error", (err) => {
        console.error("[db] Unexpected idle PostgreSQL client error", {
            error: err instanceof Error ? err.message : String(err),
        });
    });
    poolInstance = pool;
    return pool;
}
/** Backwards-compatible lazy pool proxy (pool.connect() / pool.end() etc.). */
exports.pool = new Proxy({}, {
    get(_target, property) {
        const instance = getPool();
        const value = Reflect.get(instance, property, instance);
        return typeof value === "function" ? value.bind(instance) : value;
    },
});
/**
 * Executes a parameterised SQL query through the pooled connection.
 *
 * @param text   SQL query with $1, $2, ... placeholders (pg / PgBouncer).
 * @param params Optional parameter values.
 * @returns The pg QueryResult.
 */
async function query(text, params) {
    const start = Date.now();
    let client = null;
    try {
        client = await getPool().connect();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.warn("[db] Slow query", {
                durationMs: duration,
                query: text.slice(0, 160),
            });
        }
        return result;
    }
    catch (err) {
        console.error("[db] Query failed", {
            error: err instanceof Error ? err.stack ?? err.message : String(err),
            query: text.slice(0, 200),
        });
        throw err;
    }
    finally {
        if (client) {
            client.release();
        }
    }
}
/** Returns a pooled client for multi-statement transactions. */
async function getClient() {
    return getPool().connect();
}
/**
 * Runs `fn` inside a database transaction (BEGIN/COMMIT/ROLLBACK). The client
 * is always released.
 */
async function withTransaction(fn) {
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        try {
            await client.query("ROLLBACK");
        }
        catch (rollbackErr) {
            console.error("[db] Rollback failed", {
                error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
            });
        }
        throw err;
    }
    finally {
        client.release();
    }
}
/** Gracefully closes the pool. Call during process shutdown (SIGTERM). */
async function closePool() {
    const instance = poolInstance;
    poolInstance = null;
    if (instance) {
        await instance.end();
    }
}
/** Health-check the database connection. Returns true if `SELECT 1` succeeds. */
async function dbHealthCheck() {
    try {
        await query("SELECT 1");
        return true;
    }
    catch {
        return false;
    }
}
/* ------------------------------------------------------------------ */
/* Redis (sessions, rate limiting, BullMQ)                            */
/* ------------------------------------------------------------------ */
let redisInstance = null;
/** Returns the process-wide Redis client, creating it on first call. */
function getRedis() {
    if (redisInstance)
        return redisInstance;
    const url = process.env.REDIS_URL;
    if (!url) {
        throw new BackendUnavailableError("Missing REDIS_URL. Add it to .env (see .env.example) and restart.");
    }
    const redis = new ioredis_1.default(url, {
        // BullMQ v5 requires maxRetriesPerRequest to be exactly null for
        // blocking connections (Workers / Queues). undefined will fail.
        maxRetriesPerRequest: null,
        lazyConnect: true,
        // Keep connections alive through NAT / load balancer idle timeouts.
        keepAlive: 30_000,
        connectTimeout: 10_000,
    });
    redis.on("error", (err) => {
        console.error("[redis] Unexpected Redis client error", {
            error: err instanceof Error ? err.message : String(err),
        });
    });
    redisInstance = redis;
    return redis;
}
/** Backwards-compatible lazy Redis proxy. */
exports.redis = new Proxy({}, {
    get(_target, property) {
        const instance = getRedis();
        const value = Reflect.get(instance, property, instance);
        return typeof value === "function" ? value.bind(instance) : value;
    },
});
/** Health-check Redis. Returns true if `PING` succeeds. Never throws. */
async function redisHealthCheck() {
    try {
        await getRedis().ping();
        return true;
    }
    catch {
        return false;
    }
}
/** Gracefully closes Redis. Call during process shutdown (SIGTERM). */
async function closeRedis() {
    const instance = redisInstance;
    redisInstance = null;
    if (instance) {
        await instance.quit();
    }
}
/* ------------------------------------------------------------------ */
/* Combined shutdown helper                                           */
/* ------------------------------------------------------------------ */
/** Closes both the PostgreSQL pool and Redis client. */
async function closeConnections() {
    await Promise.all([closePool(), closeRedis()]);
}
//# sourceMappingURL=database.js.map