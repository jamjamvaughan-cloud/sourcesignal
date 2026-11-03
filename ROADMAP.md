# SourceSignal — Remaining Roadmap & Post-Audit Action Plan

**Status baseline (per audit):** Working tree clean; latest commit `9a806b8` pushed to `main`; `tsc --noEmit`, `eslint`, `npm test` (63/63), and `next build` all pass; VPS API container healthy (`200` on `/api/health`); ~30.8k signals ingested across 6 active adapters.

---

## Prioritization Framework

| Priority | Meaning | SLA |
|----------|---------|-----|
| **P0** | Blocks production correctness, security, or data integrity | Immediate / this sprint |
| **P1** | Required for feature completeness or operational reliability | Next 2 sprints |
| **P2** | Optimization, polish, or scaling headroom | Next quarter |
| **P3** | Optional / nice-to-have | As capacity allows |

---

## Phase 1 — Stability & Security (P0)

### 1.1 Provision key-authenticated adapters (Enterprise Adapter Activation)
**Owner:** DevOps / Backend  
**Dependencies:** None  
**Acceptance criteria:**
- `COMPANIES_HOUSE_API_KEY`, `SAM_GOV_API_KEY`, `TED_EU_API_KEY` injected into VPS `.env` (never committed; `.env*` gitignored)
- Adapters report `enabled: true` in ingestion logs
- First successful cycle inserts Companies House / SAM.gov / TED EU records without 401s
- `npx tsc --noEmit` + `npm test` still pass

**Effort:** Small (config only; adapter code already written and self-disabling)

### 1.2 Replace VPS placeholder secrets
**Owner:** DevOps  
**Dependencies:** None  
**Acceptance criteria:**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` replaced with live values
- `NVIDIA_API_KEY` / model reference replaced with live values
- Billing checkout + webhook delivery verified end-to-end in staging

**Effort:** Small

### 1.3 Fix legacy worker schema drift
**Owner:** Backend  
**Dependencies:** None  
**Acceptance criteria:**
- `/home/jamie/projects/sourcesignal/worker/` PocketBase-era health import removed or reconciled
- Worker no longer writes to `ingestion_runs` with columns mismatched to current schema (or worker is deprecated in favor of the new `sourcesignal-ingestion` container)
- No SQL errors on schema re-apply

**Effort:** Medium

### 1.4 Re-apply schema & rebuild on VPS after every deploy
**Owner:** DevOps  
**Dependencies:** 1.1–1.3  
**Acceptance criteria:**
- VPS runs `git pull`, `psql -f src/lib/db-schema.sql`, `docker compose -f docker-compose.prod.yml up -d --build`
- `signals`, `webhooks`, `alert_logs` tables confirmed present post-apply
- No `ON_ERROR_STOP` failures

**Effort:** Small (runbook step)

---

## Phase 2 — Feature Completeness (P1)

### 2.1 Webhook & Alert Management UI (User Settings)
**Owner:** Frontend  
**Dependencies:** Webhook API routes (`GET/POST /api/webhooks`, `DELETE /api/webhooks/[id]`, `POST /api/webhooks/[id]/test`) already implemented  
**Acceptance criteria:**
- `/dashboard/settings` (or `/dashboard/integrations`) view lets authenticated users:
  - Register a webhook URL with secret, sector filters, min value, active toggle
  - List existing destinations with delivery counts / last delivery
  - Test an endpoint with a mock payload and view the result
  - Delete a destination
- Delivery logs from `alert_logs` visible per webhook
- SSRF guard respected (private/reserved IPs rejected)
- Unauthenticated access returns 401

**Effort:** Medium–Large

### 2.2 Restore `/dashboard/alerts`
**Owner:** Frontend  
**Dependencies:** None  
**Acceptance criteria:**
- Page replaced from "coming soon" placeholder with functional alert list / management
- Reuses existing `src/lib/alerts.ts`, `src/lib/alert-filters.ts`, `src/app/api/alerts/*` routes

**Effort:** Medium

### 2.3 Cross-origin credential handling audit
**Owner:** Backend / Frontend  
**Dependencies:** None  
**Acceptance criteria:**
- All cross-origin client fetches use `credentials: "include"`
- Production session cookie `Domain=sourcesignal.site; SameSite=None; Secure; HttpOnly` verified in browser dev tools
- No mixed `Session cookie is session_id` vs legacy cookie name confusion

**Effort:** Small

---

## Phase 3 — Production Deployment & DNS (P1)

### 3.1 Verify production DNS routing
**Owner:** DevOps  
**Dependencies:** None  
**Acceptance criteria:**
- `sourcesignal.site` → Vercel frontend (CNAME/A as configured by Vercel)
- `api.sourcesignal.site` → VPS public IP, terminating TLS at Caddy
- `/api/*` from Vercel frontend proxied to `https://api.sourcesignal.site` via `next.config.ts` rewrites (already implemented; confirm `NEXT_PUBLIC_API_URL` set on Vercel)
- Caddy obtains valid Let's Encrypt certificate for `api.sourcesignal.site` (sandbox currently hits ACME staging rate limits; confirm production LE works)

**Effort:** Medium

### 3.2 Background worker scaling & restart policy
**Owner:** DevOps  
**Dependencies:** Ingestion container (`sourcesignal-ingestion`) already implemented with `restart: unless-stopped`  
**Acceptance criteria:**
- Ingestion container runs the 15-minute loop continuously; 0 restarts over 24h
- `docker compose -f docker-compose.prod.yml --profile ingestion up -d` documented in runbook
- Systemd unit or equivalent for host-level container supervision (if not using Docker Swarm/Compose orchestration)
- Log aggregation for ingestion loop (container stdout → centralized logging)

**Effort:** Small–Medium

### 3.3 Schema migration runbook for production
**Owner:** DevOps  
**Dependencies:** None  
**Acceptance criteria:**
- Documented command: `docker exec -i sourcesignal-postgres psql -U sourcesignal -d sourcesignal_db -v ON_ERROR_STOP=1 < src/lib/db-schema.sql`
- Idempotency verified on re-run (no errors on existing tables/columns)
- Rollback plan noted (additive-only schema; no destructive `DROP TABLE`)

**Effort:** Small

---

## Phase 4 — Scaling & Optimization (P2–P3)

### 4.1 Ingestion performance tuning
| Item | Detail | Priority |
|------|--------|----------|
| Adapter concurrency | `runIngestionCycle` already runs adapters via `Promise.all`; consider per-adapter semaphore to avoid thundering herd on shared sources | P2 |
| Page size tuning | `LIMIT = 100` per chunk; raise for high-volume sources (GOV.UK Find a Tender = 22k+ records) after monitoring | P2 |
| Backfill resumability | Backfill currently restarts from chunk 1 on each run; add checkpoint table to resume interrupted 365-day window | P2 |
| Connection pool | `pg` Pool max 20; monitor PgBouncer wait times under concurrent ingestion + API traffic | P2 |

### 4.2 Webhook delivery reliability
| Item | Detail | Priority |
|------|--------|----------|
| Dead-letter queue | Repeatedly failing webhooks moved to DLQ after N attempts instead of endless retry | P2 |
| Delivery deduplication | Idempotency key on `alert_logs` so retries don't double-count | P3 |
| Webhook secrets rotation | Endpoint to rotate `secret` without re-registering URL | P3 |

### 4.3 Signals table growth management
| Item | Detail | Priority |
|------|--------|----------|
| Retention policy | Archive or prune signals older than N months; keep `sha256_hash` dedup window bounded | P2 |
| Partitioning | Consider `PARTITION BY RANGE (created_at)` if signals table exceeds millions of rows | P3 |
| Read replicas | If API read traffic grows, add read replica for `/api/signals` | P3 |

### 4.4 Frontend hydration polish
| Item | Detail | Priority |
|------|--------|----------|
| Optimistic updates | Filter toggles update UI before API round-trip | P3 |
| Infinite scroll | Replace `perPage=100` cap with cursor-based pagination | P3 |
| SSE integration | Wire existing `/api/signals/stream` into dashboard for real-time new-signal push | P3 |

---

## Recommended Execution Order

1. **This sprint (P0):** Inject API keys → verify 3 keyed adapters live → replace placeholder Stripe/NVIDIA secrets → fix legacy worker → re-apply schema + rebuild on VPS.
2. **Next 2 sprints (P1):** Build webhook settings UI → restore `/dashboard/alerts` → audit cross-origin credentials → finalize DNS → confirm worker restart policy.
3. **Next quarter (P2):** Ingestion perf tuning → backfill checkpointing → webhook DLQ → signals retention/archiving.
4. **As capacity allows (P3):** Partitioning, read replicas, optimistic UI, infinite scroll, SSE push.

---

## Runbook Snippets (copy-paste ready)

```bash
# On VPS, after every deploy:
cd /home/jamie/projects/sourcesignal
git pull
docker exec -i sourcesignal-postgres psql -U sourcesignal -d sourcesignal_db -v ON_ERROR_STOP=1 < src/lib/db-schema.sql
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml --profile ingestion up -d --build ingestion

# Verify schema applied:
docker exec sourcesignal-postgres psql -U sourcesignal -d sourcesignal_db -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('signals','webhooks','alert_logs');"

# Verify ingestion healthy:
docker logs sourcesignal-ingestion --tail 20 | grep -i "ingestion cycle complete"
```
