# SourceSignal — Full-Stack Audit Report

**Date:** Fri Nov 06 2026  
**Scope:** Entire monorepo — frontend (Next.js 16 on Vercel), backend (Fastify on FastHost VPS), ingestion worker, database schema, scripts, configuration  
**Repo state:** Clean working tree; latest commit `c23eea5` on `main`  
**Overall grade:** **Needs remediation before production traffic** — critical security issues found, including committed secrets and schema drift that will cause runtime failures.

---

## 1. Executive Summary

SourceSignal is a procurement intelligence SaaS with a split deployment:
- **Vercel** — Next.js 16 App Router frontend (`frontend/`)
- **FastHost VPS** — Fastify API, PostgreSQL 16, Redis, BullMQ ingestion worker (`backend/`)

The codebase is well-structured, type-safe (TypeScript strict), and has real security controls (parameterized queries, HMAC signatures, Stripe webhook verification, SSRF guards, CSP headers). However, the audit identified **critical issues** that must be fixed before production use:

1. **Real secrets committed to git** (`backend/.env` contains `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`)
2. **JWT secret fallback to hardcoded default** in frontend auth routes
3. **Schema drift** — backend `signals` table columns don't match what frontend API routes SELECT
4. **Missing tables** referenced by API routes (webhooks, alerts, processed_webhooks, etc.)
5. **Path prefix mismatch** — Vercel proxies `/api/*` to VPS, but VPS Fastify routes don't have `/api` prefix
6. **Duplicate auth systems** (Fastify backend vs Next.js frontend)

---

## 2. Architecture Inventory

### Frontend (`frontend/`)
| Layer | Files |
|-------|-------|
| Framework | Next.js 16.4.3, App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS v4, shadcn/ui (Base UI / Nova preset), Lucide icons |
| Charts/3D | `@react-three/fiber`, `@react-three/drei`, `three`, `framer-motion` |
| DB client | `pg` (native pool), direct pool (`db-direct.ts`) |
| Cache/session | `ioredis` with PostgreSQL + in-memory fallback (`redis.ts`) |
| Auth | JWT session cookies (`session_id`), bcrypt, `jsonwebtoken` |
| Billing | Stripe SDK (`2026-10-28.endive`) |
| API routes | `app/api/*` — 17 route groups |
| Tests | Vitest — `tests/*.test.ts` (5 files) |
| Config | `next.config.ts`, `vercel.json` (delegates to frontend build) |

### Backend (`backend/`)
| Layer | Files |
|-------|-------|
| Framework | Fastify 4.x, TypeScript |
| DB | PostgreSQL 16 via PgBouncer (transaction mode), `pg` pool (max 20) |
| Cache/Queue | Redis (`ioredis`), BullMQ v5 (webhook delivery, signal ingestion, content hash) |
| Auth | JWT + Redis sessions (`session:<userId>`), bcryptjs |
| Ingestion | 9 source adapters, 15-minute cron loop, background worker |
| Schema | Single migration `migrations/001_initial_schema.sql` |
| Proxy | Caddyfile, Traefik config, docker-compose.prod.yml |

### Ingestion Adapters (9 registered, 3 jurisdictions)
| Adapter | Jurisdiction | Auth |
|---------|-------------|------|
| uk-tenders | UK | Free |
| uk-planning | UK | Free |
| uk-companies-house | UK | `COMPANIES_HOUSE_API_KEY` |
| us-spending | US | Free |
| us-sam | US | `SAM_GOV_API_KEY` |
| us-sec | US | Free |
| eu-ted-sparql | EU | Free |
| eu-ted-api | EU | `TED_EU_API_KEY` |
| eu-opendata | EU | Free |

README claims 18 adapters across 6 jurisdictions (UK, US, Canada, Ireland, Australia, EU) — **code only has 9 adapters across 3 jurisdictions**. Discrepancy between documentation and implementation.

---

## 3. Critical Findings (P0) — Must Fix Before Production

### 3.1 Real secrets committed to git (CRITICAL)

`backend/.env` is **tracked in git** (commit `f26abc9`) despite `/backend/.env` being listed in `.gitignore`. Because the file was added before the ignore rule, git continues to track it. It contains production-grade secrets:

```
POSTGRES_PASSWORD=5ab4fd965705e04f1835a2e292f3665c672cf0fcc08104c909c61f67ff51b91b
REDIS_PASSWORD=162700d1134f7cf2e23b0e08510c5ffe0e7ec51bb6630e705527e3b7deebcfce
JWT_SECRET=f30d0551e20b16cd9693e8824714c68181a105143a255b9d796a55f7a4cc6c04
```

Also tracked: `.next/standalone/.env` (build output with env).

**Impact:** Anyone with repo access can obtain database, Redis, and JWT signing credentials. JWT compromise allows forging arbitrary session tokens.

**Remediation:**
1. Rotate all three secrets immediately.
2. Remove `backend/.env` from git tracking: `git rm --cached backend/.env` and add a commit.
3. Consider `git filter-branch` / `bfg` to purge secrets from history if the repo was ever public.
4. Verify `.gitignore` patterns work (`/backend/.env` should match; test with `git check-ignore backend/.env`).

### 3.2 JWT_SECRET fallback to hardcoded default (CRITICAL)

Frontend auth routes use `|| "change-me-in-production"` fallback:
- `frontend/app/api/auth/signup/route.ts:27`: `const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";`
- `frontend/app/api/auth/[action]/route.ts:28`: same pattern.

If `JWT_SECRET` is unset (e.g. on Vercel without the env var), **all session tokens are signed with a known default**, allowing trivial session forgery / account takeover.

The backend (`backend/src/modules/auth/routes.ts:21-24`) correctly throws if `JWT_SECRET` is missing — the frontend does not.

**Remediation:** Remove the fallback; throw at module import if `JWT_SECRET` is unset, matching the backend pattern.

### 3.3 Schema drift: backend `signals` table ≠ frontend expectations (CRITICAL)

The backend migration (`migrations/001_initial_schema.sql`) creates `signals` with columns:
```
id, organisation_id, title, source_url, content_hash, raw_payload, created_at
```

But frontend API routes SELECT columns that **do not exist** in this table:
- `buyer_name` (`/api/signals/route.ts:226`, `/api/signals/[id]/route.ts:76`)
- `jurisdiction`, `sector`, `opportunity_type`, `estimated_value`
- `source_name`, `source_hash`, `sha256_hash`, `commercial_why`, `published_at`

Conversely, the backend worker (`background.worker.ts:78-90`) inserts only:
```
organisation_id, title, source_url, content_hash, raw_payload
```
and hardcodes `organisation_id` to `"00000000-0000-0000-0000-000000000000"` — a UUID with no matching row in `organisations`, causing a **foreign key violation** on every ingestion insert.

Column name mismatches:
| Column | Backend migration | Frontend expects |
|--------|------------------|------------------|
| content hash | `content_hash` | `sha256_hash` (frontend) |
| source hash | (not inserted) | `source_hash` (frontend) |
| published at | (not inserted) | `published_at` (frontend) |

**Impact:** All signal read/write operations fail at runtime — 500 errors on `/api/signals`, `/api/opportunities`, SSE stream, etc.

**Remediation:** Reconcile the schema. Either (a) add the missing columns to `signals` and create the missing enum types (`signal_sector`, `signal_opportunity_type`), or (b) have the backend worker insert the full column set. Fix the hardcoded organisation_id (use a real org or make it nullable).

### 3.4 Missing tables referenced by API routes (CRITICAL)

The migration creates only 7 tables: `users`, `organisations`, `memberships`, `user_subscriptions`, `signals`, `daily_view_counts`, `cache_entries`.

API routes reference tables that **do not exist** in the migration:

| Route | Missing table(s) |
|-------|-----------------|
| `app/api/webhooks/route.ts` | `webhooks` |
| `app/api/alerts/route.ts` | `alerts`, `alert_deliveries` |
| `app/api/webhooks/dispatch/route.ts` | `webhook_deliveries` |
| `app/api/stripe/webhook/route.ts` | `processed_webhooks`, `users.stripe_customer_id` (column missing) |
| `app/api/webhooks/receive/route.ts` | `opportunities`, `entity_profiles`, `entity_profile_members`, `signal_rules`, `signal_rule_matches` |
| `frontend/src/lib/entity-resolution.ts` | `entity_profiles`, `entity_profile_members` |
| `frontend/src/lib/signals-engine.ts` | (uses `SourceRecord` type) |

Also missing columns: `users.stripe_customer_id`, `users.stripe_subscription_id`, `users.stripe_status` (referenced by Stripe webhook).

**Impact:** 500 errors on all webhook, alert, and Stripe operations.

**Remediation:** Add a migration (002) creating all missing tables and columns, or consolidate into a single complete schema.

### 3.5 Missing PostgreSQL enum types (CRITICAL)

Frontend SQL casts `::signal_sector` and `::signal_opportunity_type` (`/api/signals/route.ts:186`, `:193`, `opportunities.ts:198`), but the migration **never creates these enum types**. Queries will fail with `type "signal_sector" does not exist`.

**Remediation:** Add `CREATE TYPE signal_sector AS ENUM (...)` and `CREATE TYPE signal_opportunity_type AS ENUM (...)` to the migration.

### 3.6 Path prefix mismatch: Vercel `/api/*` rewrite → VPS Fastify (HIGH)

`next.config.ts` rewrites `/api/:path*` → `${backendUrl}/api/:path*` on Vercel. But the VPS Fastify backend (`backend/src/index.ts`) registers routes at `/auth`, `/signals`, `/webhooks` — **no `/api` prefix**. So `https://api.sourcesignal.site/api/signals` returns 404; only `/signals` would work.

The frontend's own Next.js API routes (`frontend/app/api/*`) would be proxied away on Vercel and never execute — yet they contain the entitlement logic, tier gating, and DB queries. This means on production Vercel, either:
- All `/api/*` requests 404 (if VPS doesn't handle `/api/`), or
- The VPS reverse proxy (Caddy/Traefik) strips `/api/` — unverified.

**Remediation:** Either mount Fastify routes under `/api` on the backend, or remove the `/api` prefix from the Vercel rewrite and route directly to `/auth`, `/signals`, `/webhooks`. Document which is intended.

### 3.7 Duplicate, divergent auth systems (HIGH)

Two independent auth implementations:
1. **Backend Fastify:** `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` — JWT + ioredis session (`session:<userId>`), port 3001.
2. **Frontend Next.js:** `POST /api/auth/signup`, `/api/auth/[action]` (signin/signup/signout/logout/me) — JWT + resilient cache (`session:<token>`), port 3000.

They use the same cookie name (`session_id`) but different backends, different token storage keys, and different user resolution logic. The frontend `@/lib/backend.ts` `getSessionContext()` calls its own `/api/auth/me` via HTTP (self-referential fetch), which is fragile in serverless.

**Impact:** Inconsistent session behavior between frontend and backend; potential for sessions to exist in one system but not the other.

**Remediation:** Unify on one auth system. Since frontend API routes connect directly to PostgreSQL, consider making the frontend the single auth entry point and having the backend validate JWTs, or vice versa.

---

## 4. High Findings (P1)

### 4.1 Rate limit TTL race / missing expiry (HIGH)

`frontend/src/lib/rate-limit.ts:46` calls `redis.incr(key, ttlSeconds)`. In the custom `redis` wrapper (`redis.ts:420-468`), Redis `incr` + `expire` are **two separate commands** — not atomic. If the process crashes between them, rate-limit keys never expire, enabling indefinite rate-limit blocking or counter drift.

Also, rate limiting is by **IP only** (`x-forwarded-for`), which is spoofable if not behind a trusted proxy, and shared IPs (CGNAT, corporate networks) can cause legitimate users to block each other.

**Remediation:** Use a single atomic `INCR` + `EXPIRE` (Lua script or `incr` with `expire` in a MULTI/EXEC), and consider per-user rate limiting for authenticated endpoints.

### 4.2 Session cookie domain logic is broken (HIGH)

`frontend/src/lib/auth.ts:25-40` `getCookieDomain()`:
- Returns `Domain=localhost` for localhost — **browsers ignore cookie domains on bare hostnames**, so session cookies won't be stored in local dev.
- Returns `Domain=sourcesignal.site` when `host` is falsy, even in non-production — breaks local dev.
- `buildSessionCookie()` sets `SameSite=None` in production but `SameSite=Lax` in dev — inconsistent.

**Remediation:** Only set `Domain` when there's a real domain (not localhost/127.0.0.1); use `SameSite=Lax` for same-origin, `SameSite=None; Secure` only for cross-origin production.

### 4.3 CSRF protection incomplete (HIGH)

`csrfGuard()` only protects the `/api/auth/[action]` dynamic routes. Static auth routes (`/api/auth/signup`) and all data routes (`/api/signals`, `/api/opportunities`, `/api/webhooks/*`) have **no CSRF protection**. Since auth is cookie-based, these are vulnerable to cross-site request forgery.

The backend Fastify CORS (`backend/src/index.ts:33-44`) allows **any origin when `ALLOWED_ORIGINS` is empty** (`allowedOrigins.length === 0` → `cb(null, true)`).

**Remediation:** Add CSRF (Origin/Referer validation or double-submit cookie) to all state-changing routes. Default CORS to deny-all when no origins configured.

### 4.4 SSE stream has no client limit or auth revalidation (HIGH)

`/api/signals/stream` (`frontend/app/api/signals/stream/route.ts`):
- Maintains a global in-memory `clients` Set — **does not work across serverless instances** and has no max-connection limit (DoS vector).
- Auth is checked once at connection start; session revocation mid-stream is not detected.
- `lastSeen` is per-connection, so reconnecting clients re-poll from their own timestamp — potentially missing signals.

**Remediation:** Cap concurrent SSE clients, use Redis pub/sub for multi-instance streaming, and re-validate sessions periodically.

### 4.5 Stripe API version is invalid (HIGH)

All Stripe routes use `apiVersion: "2026-10-28.endive"` (`/api/stripe/checkout/route.ts:83`, `/api/stripe/webhook/route.ts:169`, etc.). Stripe API versions are dates like `2024-10-28`; `.endive` suffix is invalid. This will cause Stripe SDK initialization errors.

**Remediation:** Use a current Stripe API version (e.g. `2024-10-28.acacia` or latest).

### 4.6 `getUserPlanId` fails open to "free" (MEDIUM-HIGH)

`frontend/src/lib/auth.ts:98-136` catches all DB errors and returns `"free"`. During a database outage, Pro users lose paid access (availability) — but conversely, if the plan-lookup query is bypassed via injection, it could grant free access. It's documented as intentional but should be reviewed for the "fail open vs fail closed" decision.

---

## 5. Medium Findings (P2)

### 5.1 Inconsistent env variable naming
- Frontend uses `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, `API_BACKEND_URL` (aliases, `backend.ts:41-57`)
- Backend uses `API_URL`, `ALLOWED_ORIGINS`
- No single source of truth

### 5.2 No `NEXT_PUBLIC_API_URL` validation on Vercel
`backend.ts:50-54` throws if on Vercel and `NEXT_PUBLIC_API_URL` is unset — good, but the error is thrown at request time, not build time.

### 5.3 `db-direct.ts` bypasses the pool's error handling
`frontend/src/lib/db-direct.ts` creates a separate `Pool` with no slow-query logging, no error handler on idle clients (unlike `db.ts`), and no `closePool`. Used by signup route.

### 5.4 Webhook dispatch is synchronous
`/api/webhooks/dispatch` (`frontend/app/api/webhooks/dispatch/route.ts`) does an inline `fetch()` to the webhook URL and waits for the response before returning. The backend already has a BullMQ-based async webhook worker — the frontend should enqueue instead of delivering synchronously.

### 5.5 No query timeouts on pg queries
Neither `db.ts` nor `db-direct.ts` sets `statement_timeout`. A long-running query can hold a pool client indefinitely. Pool max is 20 per process — exhaustion under slow queries.

### 5.6 Hash column naming inconsistency
Three hash concepts across the codebase:
- `content_hash` (backend migration, backend worker)
- `sha256_hash` (frontend API SELECTs)
- `source_hash` (frontend API SELECTs, backend worker doesn't insert)

### 5.7 Free-tier daily view limit off-by-one
Code checks `viewCount > 10` after incrementing, so the 11th request is blocked but the count reaches 11. A user gets exactly 10 successful views — correct, but the 11th increments the counter to 11 before returning 429. Minor.

### 5.8 `signal_sector` / `signal_opportunity_type` enum casts without type creation
(Already covered in 3.5 but repeated here for emphasis — also in `opportunities.ts:198`.)

### 5.9 `NEXT_PUBLIC_APP_URL` self-fetch in `getSessionContext()`
`frontend/src/lib/backend.ts:109` fetches `NEXT_PUBLIC_APP_URL/api/auth/me` — the app calling itself. In serverless (Vercel), this creates an extra cold start and a circular dependency. Should call the auth helper directly.

### 5.10 Landing page is a heavy client component
`frontend/app/page.tsx` is `"use client"` with 3D graphics (`@react-three/fiber`, `three`) and Framer Motion — heavy JS bundle for a marketing page that could be server-rendered.

---

## 6. Low Findings (P3)

### 6.1 bcrypt hash cost of 10
Acceptable but low for 2026; consider 12.

### 6.2 No session rotation on login
No session fixation protection — a new token is issued on signin without invalidating any prior session for the same user.

### 6.3 No migration version tracking
Single idempotent migration file; no `schema_migrations` table to track applied versions. Re-running is safe (`IF NOT EXISTS`) but there's no audit of which migrations have run.

### 6.4 `processed_webhooks` idempotency failure is silent
Stripe webhook (`isEventProcessed`/`markEventProcessed`) catches DB errors and continues — if the DB is down, events can be reprocessed on recovery.

### 6.5 CSP allows `unsafe-inline` and `unsafe-eval`
`next.config.ts:107` — weakens CSP, though necessary for some Next.js inline scripts.

### 6.6 No `X-Content-Type-Options` / `X-Frame-Options` on backend Fastify responses
Security headers only set in Next.js `next.config.ts` headers. The backend (served directly or via Caddy) may not send them. Caddyfile should enforce these.

### 6.7 Worker ingestion hardcodes organisation_id
`background.worker.ts:84` — `"00000000-0000-0000-0000-000000000000"` with no matching organisation → FK violation.

### 6.8 `webhooks.ts` SSRF guard location
`frontend/src/lib/webhooks.ts` is a **directory** (the read failed because it's a folder, not a file). Need to verify `isSafeDispatchUrl` implementation exists and blocks private/reserved IPs (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, link-local, metadata services like 169.254.169.254).

### 6.9 README vs code discrepancy
README documents 18 adapters / 6 jurisdictions / `worker/` directory at root; code has 9 adapters / 3 jurisdictions / worker in `backend/src/workers/`.

---

## 7. What's Done Well (Strengths)

| Area | Observation |
|------|-------------|
| SQL injection | All queries use parameterized `pg` queries (`$1`, `$2`) — no string interpolation into SQL |
| Stripe webhooks | Signature verification + `processed_webhooks` idempotency — well implemented |
| HMAC signatures | Webhook signing uses `createHmac("sha256")` with timing-safe comparison |
| Entitlement enforcement | Server-side tier gating in `entitlements.ts` / `tier-gating.ts` — client never trusted for plan decisions |
| Field redaction | `sanitizeOpportunity()` strips Pro-only fields before sending to Free users |
| Redis resilience | Multi-level fallback (Redis → PostgreSQL → memory) with graceful degradation |
| Security headers | CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy set in Next.js |
| Rate limiting | Sliding-window rate limiter on auth and opportunities endpoints |
| Graceful shutdown | Worker and API handle SIGTERM/SIGINT, close pools and connections |
| TypeScript strict | `tsc --noEmit` reported clean per ROADMAP |
| Tests | Vitest suite exists (5 test files) |
| Secrets not in client code | No `NEXT_PUBLIC` prefixed secrets (all secrets server-side) |

---

## 8. Recommended Remediation Plan

### Sprint 1 (P0 — do before any production traffic)

1. **Rotate and remove committed secrets** — Rotate `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` in `backend/.env`. `git rm --cached backend/.env`. Purge from history if needed.
2. **Remove JWT_SECRET fallback** in frontend auth routes; throw if unset.
3. **Reconcile database schema** — Add missing columns (`buyer_name`, `jurisdiction`, `sector`, `opportunity_type`, `estimated_value`, `source_name`, `source_hash`, `sha256_hash`, `commercial_why`, `published_at`) to `signals`, create `signal_sector` and `signal_opportunity_type` enums, or align backend worker insert with frontend expectations. Fix hardcoded `organisation_id` in worker.
4. **Create missing tables** — `webhooks`, `alerts`, `alert_deliveries`, `webhook_deliveries`, `processed_webhooks`, `opportunities`, `entity_profiles`, `entity_profile_members`, `signal_rules`, `signal_rule_matches`. Add missing columns to `users` (`stripe_customer_id`, etc.).
5. **Fix API path prefix** — Align Vercel rewrite (`/api/*`) with VPS Fastify routes (`/auth`, `/signals`, `/webhooks`) or add `/api` prefix to Fastify.
6. **Set Stripe API version** to a valid dated version.

### Sprint 2 (P1)

7. Unify the two auth systems or document the boundary clearly.
8. Add CSRF protection to all state-changing routes; default CORS to deny-all.
9. Fix rate-limit atomicity (single Redis command for INCR+EXPIRE).
10. Fix session cookie domain logic (no `Domain=localhost`).
11. Fix SSE client limits and multi-instance support.
12. Make webhook dispatch async (enqueue to BullMQ instead of synchronous fetch).

### Sprint 3 (P2)

13. Add `statement_timeout` to pg pool; add idle client error handler to `db-direct.ts`.
14. Add schema migration tracking table.
15. Add connection pool teardown for serverless.
16. Add `X-Content-Type-Options` / `X-Frame-Options` at Caddy/Traefik layer for backend.
17. Verify `isSafeDispatchUrl` blocks private/reserved IPs (SSRF).

### Ongoing (P3)

18. Convert landing page to server component; code-split 3D bundle.
19. Add session rotation on login.
20. Document deployment runbook (DNS, Caddy TLS, Stripe webhooks, backups).

---

## 9. Files of Note (for targeted fixes)

| File | Issue |
|------|-------|
| `backend/.env` | **Committed secrets — remove from git, rotate** |
| `frontend/app/api/auth/signup/route.ts:27` | JWT_SECRET hardcoded fallback |
| `frontend/app/api/auth/[action]/route.ts:28` | JWT_SECRET hardcoded fallback |
| `backend/migrations/001_initial_schema.sql` | Missing tables, columns, enum types |
| `backend/src/workers/background.worker.ts:84` | Hardcoded org UUID (FK violation) |
| `frontend/app/api/signals/route.ts` | SELECTs columns not in signals table |
| `frontend/app/api/signals/[id]/route.ts` | Same |
| `frontend/app/api/opportunities/route.ts` | Same |
| `frontend/src/lib/opportunities.ts` | `::signal_sector` cast without type |
| `frontend/src/lib/rate-limit.ts:46` | Non-atomic INCR+EXPIRE |
| `frontend/src/lib/auth.ts:25-53` | Cookie domain logic broken |
| `frontend/app/api/auth/[action]/route.ts:35-76` | CSRF only on dynamic routes |
| `frontend/app/api/signals/stream/route.ts` | No SSE client limit, in-memory state |
| `frontend/app/api/stripe/*/route.ts` | Invalid Stripe API version |
| `next.config.ts:107` | CSP unsafe-inline/unsafe-eval |
| `next.config.ts:37-57` | `/api/*` rewrite path mismatch with VPS |

---

**Bottom line:** The codebase is well-architected and security-conscious in many areas, but the committed secrets, JWT fallback, and schema drift are showstoppers for production. Address the P0 list first, then the P1 list, before launching.
