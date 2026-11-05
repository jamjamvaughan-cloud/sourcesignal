/**
 * Resilient cache / session store.
 *
 * The application prefers Redis, but Redis is **optional**. When `REDIS_URL`
 * is unset (typical local development) or Redis is unreachable, every
 * operation transparently falls back to:
 *
 *   1. PostgreSQL `cache_entries` (shared across server processes), then
 *   2. an in-process `Map` (single-process only, last resort).
 *
 * This module never throws at import time because Redis is missing. Command
 * failures are contained and reported through `cacheStatus()` / `ping()` so
 * health checks can distinguish "healthy", "degraded" and "unhealthy".
 */

import Redis from "ioredis";
import { query } from "@/lib/db";

export type CacheBackend = "redis" | "postgres" | "memory";
export type RedisStatus = "connected" | "unavailable" | "disabled";

/** Default session lifetime: 7 days. */
export const DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60;

const REDIS_URL = process.env.REDIS_URL?.trim() || "";
const CONNECT_TIMEOUT_MS = 1_500;
const REDIS_RETRY_COOLDOWN_MS = 15_000;
const POSTGRES_RETRY_COOLDOWN_MS = 10_000;
const MEMORY_SWEEP_THRESHOLD = 10_000;

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

interface CacheState {
  client: Redis | null;
  redisStatus: "disabled" | "unknown" | "ready" | "unavailable";
  lastRedisAttempt: number;
  postgresDisabled: boolean;
  postgresRetryAt: number;
  memory: Map<string, MemoryEntry>;
}

// Persist state across Next.js hot reloads / module re-evaluations.
const globalForCache = globalThis as typeof globalThis & {
  __sourceSignalCache?: CacheState;
};

const state: CacheState =
  globalForCache.__sourceSignalCache ?? {
    client: null,
    redisStatus: REDIS_URL ? "unknown" : "disabled",
    lastRedisAttempt: 0,
    postgresDisabled: false,
    postgresRetryAt: 0,
    memory: new Map(),
  };

globalForCache.__sourceSignalCache = state;

interface Attempt<T> {
  ok: boolean;
  value?: T;
}

function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: CONNECT_TIMEOUT_MS,
    commandTimeout: CONNECT_TIMEOUT_MS,
    // Do not reconnect forever in the background; callers fall back instead.
    retryStrategy: () => null,
  });

  client.on("ready", () => {
    state.redisStatus = "ready";
    console.log("[cache] Redis connected.");
  });

  client.on("end", () => {
    if (state.redisStatus !== "disabled") {
      state.redisStatus = "unavailable";
    }
  });

  client.on("error", (err: Error) => {
    // ioredis emits errors repeatedly while reconnecting. Log once per outage.
    if (state.redisStatus !== "unavailable") {
      console.warn(
        `[cache] Redis unavailable (${err.message}); using fallback store.`,
      );
    }
    state.redisStatus = "unavailable";
  });

  return client;
}

/**
 * Returns a connected Redis client, attempting to connect at most once per
 * cooldown window. Returns null when Redis is disabled or unavailable.
 */
async function getRedisClient(): Promise<Redis | null> {
  if (!REDIS_URL) return null;

  if (state.redisStatus === "ready" && state.client) {
    return state.client;
  }

  const now = Date.now();
  if (
    state.redisStatus === "unavailable" &&
    now - state.lastRedisAttempt < REDIS_RETRY_COOLDOWN_MS
  ) {
    return null;
  }

  state.lastRedisAttempt = now;
  if (!state.client) {
    state.client = createRedisClient();
  }

  const client = state.client;

  try {
    if (client.status === "wait" || client.status === "end") {
      await client.connect();
    }
    if (client.status === "ready") {
      state.redisStatus = "ready";
      return client;
    }
    state.redisStatus = "unavailable";
    return null;
  } catch {
    state.redisStatus = "unavailable";
    return null;
  }
}

async function withRedis<T>(
  operation: (client: Redis) => Promise<T>,
): Promise<Attempt<T>> {
  const client = await getRedisClient();
  if (!client) return { ok: false };

  try {
    return { ok: true, value: await operation(client) };
  } catch {
    state.redisStatus = "unavailable";
    state.lastRedisAttempt = Date.now();
    return { ok: false };
  }
}

async function withPostgres<T>(
  operation: () => Promise<T>,
): Promise<Attempt<T>> {
  if (state.postgresDisabled) return { ok: false };
  if (Date.now() < state.postgresRetryAt) return { ok: false };

  try {
    return { ok: true, value: await operation() };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "42P01") {
      // cache_entries does not exist: the schema has not been applied.
      // Disable this backend for the lifetime of the process.
      state.postgresDisabled = true;
      console.warn(
        "[cache] cache_entries table missing; using in-memory fallback. " +
          "Apply src/lib/db-schema.sql to enable the PostgreSQL cache.",
      );
    } else {
      state.postgresRetryAt = Date.now() + POSTGRES_RETRY_COOLDOWN_MS;
    }
    return { ok: false };
  }
}

function memoryGet(key: string): string | null {
  const entry = state.memory.get(key);
  if (!entry) return null;

  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    state.memory.delete(key);
    return null;
  }

  return entry.value;
}

function memorySet(
  key: string,
  value: string,
  ttlSeconds?: number | null,
): void {
  if (state.memory.size >= MEMORY_SWEEP_THRESHOLD) {
    const now = Date.now();
    for (const [entryKey, entry] of state.memory) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        state.memory.delete(entryKey);
      }
    }
  }

  state.memory.set(key, {
    value,
    expiresAt:
      ttlSeconds && ttlSeconds > 0
        ? Date.now() + ttlSeconds * 1000
        : null,
  });
}

function memoryDelete(key: string): number {
  return state.memory.delete(key) ? 1 : 0;
}

function memoryIncr(key: string, ttlSeconds?: number): number {
  const now = Date.now();
  const existing = state.memory.get(key);

  if (
    existing &&
    (existing.expiresAt === null || existing.expiresAt > now)
  ) {
    const value = (Number(existing.value) || 0) + 1;
    existing.value = String(value);
    return value;
  }

  state.memory.set(key, {
    value: "1",
    expiresAt:
      ttlSeconds && ttlSeconds > 0
        ? now + ttlSeconds * 1000
        : null,
  });
  return 1;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function globToSqlLike(glob: string): string {
  return glob
    .replace(/[\\%_]/g, "\\$&")
    .replace(/\*/g, "%")
    .replace(/\?/g, "_");
}

function memoryKeys(pattern: string): string[] {
  const now = Date.now();
  const matcher = globToRegExp(pattern);
  const keys: string[] = [];

  for (const [key, entry] of state.memory) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      state.memory.delete(key);
      continue;
    }
    if (matcher.test(key)) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Writes to the durable fallback chain (PostgreSQL, then memory).
 * Used directly for sessions so they survive a Redis outage.
 */
async function writeDurable(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<CacheBackend> {
  const persisted = await withPostgres(async () => {
    await query(
      `INSERT INTO cache_entries (key, value, expires_at, created_at, updated_at)
       VALUES (
         $1,
         $2,
         CASE WHEN $3::int IS NULL THEN NULL
              ELSE NOW() + make_interval(secs => $3::int) END,
         NOW(),
         NOW()
       )
       ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()`,
      [key, value, ttlSeconds && ttlSeconds > 0 ? ttlSeconds : null],
    );
    return true;
  });

  if (persisted.ok) return "postgres";

  memorySet(key, value, ttlSeconds);
  return "memory";
}

/**
 * Cache facade. All methods are async and never throw on backend failure.
 */
export const redis = {
  /**
   * Reads a value from Redis, then PostgreSQL, then memory.
   */
  async get(key: string): Promise<string | null> {
    const cached = await withRedis((client) => client.get(key));
    if (cached.ok && typeof cached.value === "string") {
      return cached.value;
    }

    const persisted = await withPostgres(async () => {
      const result = await query(
        `SELECT value
           FROM cache_entries
          WHERE key = $1
            AND (expires_at IS NULL OR expires_at > NOW())`,
        [key],
      );
      return (result.rows[0]?.value as string | undefined) ?? null;
    });

    if (persisted.ok && typeof persisted.value === "string") {
      return persisted.value;
    }

    return memoryGet(key);
  },

  /**
   * Writes a value to the first available backend. Returns that backend so
   * callers can report which store is active.
   */
  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<CacheBackend> {
    const cached = await withRedis((client) =>
      ttlSeconds && ttlSeconds > 0
        ? client.set(key, value, "EX", ttlSeconds)
        : client.set(key, value),
    );
    if (cached.ok) return "redis";

    return writeDurable(key, value, ttlSeconds);
  },

  /**
   * Deletes a key from every backend so stale copies cannot resurface when a
   * higher-priority backend recovers.
   */
  async del(key: string): Promise<number> {
    let deleted = 0;

    const cached = await withRedis((client) => client.del(key));
    if (cached.ok) deleted += cached.value ?? 0;

    const persisted = await withPostgres(async () => {
      const result = await query(`DELETE FROM cache_entries WHERE key = $1`, [
        key,
      ]);
      return result.rowCount ?? 0;
    });
    if (persisted.ok) deleted += persisted.value ?? 0;

    deleted += memoryDelete(key);
    return deleted;
  },

  /**
   * Returns all live keys matching a glob (e.g. `session:*`) across backends.
   */
  async keys(pattern: string): Promise<string[]> {
    const found = new Set<string>();

    const cached = await withRedis((client) => client.keys(pattern));
    if (cached.ok && cached.value) {
      for (const key of cached.value) found.add(key);
    }

    const persisted = await withPostgres(async () => {
      const result = await query(
        `SELECT key
           FROM cache_entries
          WHERE key LIKE $1
            AND (expires_at IS NULL OR expires_at > NOW())`,
        [globToSqlLike(pattern)],
      );
      return result.rows.map((row) => row.key as string);
    });
    if (persisted.ok && persisted.value) {
      for (const key of persisted.value) found.add(key);
    }

    for (const key of memoryKeys(pattern)) found.add(key);

    return Array.from(found);
  },

  /**
   * Atomically increments a counter, creating it with an optional TTL.
   * Used by the rate limiter.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const cached = await withRedis(async (client) => {
      const value = await client.incr(key);
      if (value === 1 && ttlSeconds && ttlSeconds > 0) {
        await client.expire(key, ttlSeconds);
      }
      return value;
    });
    if (cached.ok && cached.value !== undefined) {
      return cached.value;
    }

    const persisted = await withPostgres(async () => {
      const result = await query(
        `INSERT INTO cache_entries (key, value, expires_at, created_at, updated_at)
         VALUES (
           $1,
           '1',
           CASE WHEN $2::int IS NULL THEN NULL
                ELSE NOW() + make_interval(secs => $2::int) END,
           NOW(),
           NOW()
         )
         ON CONFLICT (key) DO UPDATE
            SET value = CASE
                  WHEN cache_entries.expires_at IS NOT NULL
                       AND cache_entries.expires_at <= NOW()
                    THEN '1'
                  ELSE ((cache_entries.value)::bigint + 1)::text
                END,
                expires_at = CASE
                  WHEN cache_entries.expires_at IS NOT NULL
                       AND cache_entries.expires_at <= NOW()
                    THEN CASE WHEN $2::int IS NULL THEN NULL
                              ELSE NOW() + make_interval(secs => $2::int) END
                  ELSE cache_entries.expires_at
                END,
                updated_at = NOW()
         RETURNING value`,
        [key, ttlSeconds && ttlSeconds > 0 ? ttlSeconds : null],
      );
      return Number(result.rows[0]?.value ?? 0);
    });
    if (persisted.ok && persisted.value !== undefined) {
      return persisted.value;
    }

    return memoryIncr(key, ttlSeconds);
  },

  /**
   * Pings Redis. Returns "PONG" only when Redis itself responded.
   */
  async ping(): Promise<"PONG" | null> {
    const result = await withRedis((client) => client.ping());
    return result.ok && result.value === "PONG" ? "PONG" : null;
  },
};

export interface SessionData {
  userId: string;
  email?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Persists a session record under `session:<token>`.
 *
 * When Redis is connected the session is stored there; otherwise the durable
 * PostgreSQL / memory fallback is used. The returned backend is informational.
 */
export async function setSession(
  token: string,
  data: SessionData,
  ttlSeconds: number = DEFAULT_SESSION_TTL,
): Promise<CacheBackend> {
  const key = `session:${token}`;
  const value = JSON.stringify({
    ...data,
    createdAt: data.createdAt ?? new Date().toISOString(),
  });

  const backend = await redis.set(key, value, ttlSeconds);

  // Sessions are mirrored to the durable fallback even when Redis accepted the
  // write, so a Redis restart does not log every user out.
  if (backend === "redis") {
    await writeDurable(key, value, ttlSeconds);
  }

  return backend;
}

/**
 * Reads and parses a session record. Returns null for missing, expired or
 * malformed entries.
 */
export async function getSession(
  token: string,
): Promise<SessionData | null> {
  if (!token) return null;

  const raw = await redis.get(`session:${token}`);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { userId?: unknown }).userId !== "string"
    ) {
      return null;
    }
    return parsed as SessionData;
  } catch {
    return null;
  }
}

/** Removes a session from every backend. */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await redis.del(`session:${token}`);
}

export interface CacheStatus {
  /** Backend that would serve the next operation. */
  backend: CacheBackend;
  redis: RedisStatus;
  postgres: "available" | "unavailable" | "unknown";
  memoryEntries: number;
}

/**
 * Reports the active cache backend. Redis is probed with `PING`; the
 * PostgreSQL fallback is probed with a lightweight `cache_entries` read.
 */
export async function cacheStatus(): Promise<CacheStatus> {
  const memoryEntries = state.memory.size;

  if (await redis.ping()) {
    return {
      backend: "redis",
      redis: "connected",
      postgres: state.postgresDisabled ? "unavailable" : "unknown",
      memoryEntries,
    };
  }

  const persisted = await withPostgres(async () => {
    await query(`SELECT 1 FROM cache_entries LIMIT 1`);
    return true;
  });

  return {
    backend: persisted.ok ? "postgres" : "memory",
    redis: REDIS_URL ? "unavailable" : "disabled",
    postgres: persisted.ok ? "available" : "unavailable",
    memoryEntries,
  };
}

/**
 * Clears the in-process fallback store. Intended for tests and local resets.
 */
export function resetMemoryCache(prefix?: string): void {
  if (!prefix) {
    state.memory.clear();
    return;
  }
  for (const key of state.memory.keys()) {
    if (key.startsWith(prefix)) {
      state.memory.delete(key);
    }
  }
}

/**
 * Gracefully disconnects Redis. Call during process shutdown.
 */
export async function closeRedis(): Promise<void> {
  const client = state.client;
  state.client = null;
  state.redisStatus = REDIS_URL ? "unknown" : "disabled";
  state.lastRedisAttempt = 0;

  if (!client) return;

  try {
    if (client.status === "ready") {
      await client.quit();
    } else {
      client.disconnect();
    }
  } catch {
    client.disconnect();
  }
}

/**
 * Returns true when Redis itself responds to `PING`.
 */
export async function healthCheck(): Promise<boolean> {
  return (await redis.ping()) === "PONG";
}
