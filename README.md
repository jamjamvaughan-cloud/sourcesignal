# SourceSignal

Commercial intelligence and procurement SaaS — discover, evaluate and monitor procurement opportunities across supported sectors and regions.

## Status

Full ingestion pipeline, entitlement system, PostgreSQL backend, Stripe billing, AI extraction, and SHA-256 provenance are implemented and tested. Deployed as a Vercel frontend + FastHost VPS backend.

## Technology stack

- **Next.js 16** — App Router, React Server Components
- **React 19**
- **TypeScript** — strict mode
- **Tailwind CSS v4** — design tokens via CSS variables
- **shadcn/ui** — accessible UI primitives (Base UI / Nova preset, Lucide icons)
- **Lucide** — icons
- **PostgreSQL 16** — database (Redis optional for cache/sessions)
- **Vercel + FastHost VPS** — split deployment: Vercel serves the frontend, the VPS runs the API, data and ingestion
- **ESLint / Vitest** — linting and testing

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # then edit .env with your values

# 3. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment configuration

| Variable | Required | Public? | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | No | PostgreSQL 16 connection string |
| `REDIS_URL` | Yes | No | Redis URL (sessions, rate limiting) |
| `JWT_SECRET` | Yes (production) | No | Session token signing secret |
| `STRIPE_SECRET_KEY` | No (test mode OK) | No | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No (test mode OK) | No | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PRO` | No (test mode OK) | No | Stripe price ID for Pro plan |
| `WEBHOOK_SIGNING_SECRET` | No | No | Webhook signing secret |

All `.env*` files are gitignored. See `.env.example` for the template.

## Local Next.js development

```bash
npm run dev      # dev server with Turbopack
npm run build    # production build (standalone output)
npm run start    # start production server
npm run lint     # ESLint
npx tsc --noEmit # TypeScript type check
npm run test     # Vitest test suite
```

## Local PostgreSQL setup

PostgreSQL 16 is the backend for records, authentication and server-side operations. Redis is optional: when it is not configured or unreachable, sessions and rate-limit counters fall back to PostgreSQL (`cache_entries`) and then in-process memory.

1. Start PostgreSQL (Docker):

   ```bash
   docker run --name sourcesignal-db \
     -e POSTGRES_PASSWORD=secretpassword \
     -p 5432:5432 -d postgres:16-alpine
   docker exec -it sourcesignal-db createdb -U postgres sourcesignal_db
   ```

2. Apply the native schema (idempotent):

   ```bash
   docker exec -i sourcesignal-db psql -U postgres -d sourcesignal_db < src/lib/db-schema.sql
   # or, with DATABASE_URL exported:
   npx tsx scripts/apply-schema.ts
   ```

3. Start Redis (optional, recommended for multi-instance deployments):

   ```bash
   docker run --name sourcesignal-redis -p 6379:6379 -d redis:7-alpine
   ```

   Leave `REDIS_URL` unset to use the PostgreSQL/memory fallback.

4. Configure `.env`:

   ```dotenv
   DATABASE_URL="postgres://postgres:secretpassword@localhost:5432/sourcesignal_db?sslmode=disable"
   REDIS_URL="redis://localhost:6379"
   JWT_SECRET="<generate with: openssl rand -hex 32>"
   ```

To reset local data, drop and recreate the database:

```bash
npx tsx scripts/reset-db.ts
```

## Production deployment (Vercel + FastHost VPS)

The app is deployed as two halves of the same codebase:

- **Vercel** (`sourcesignal.site`) — Next.js frontend. `/api/*` is rewritten to the VPS; no database or secret credentials live on Vercel.
- **FastHost VPS** (`api.sourcesignal.site`) — Next.js API routes, PostgreSQL, PgBouncer, Redis, Caddy TLS, and the ingestion worker.

Supporting files:

- `Dockerfile` — multi-stage standalone Next.js build for the VPS, non-root user, port `3000`.
- `docker-compose.prod.yml` — hardened stack; only Caddy publishes host ports.
- `Caddyfile` — automatic TLS for `api.sourcesignal.site`.
- `.env.production.example` — VPS environment template.
- `next.config.ts` — rewrites `/api/*` to `BACKEND_URL` when running on Vercel.

See `docs/deployment-vercel-vps.md` for DNS, secrets, Stripe webhooks, backups and the full runbook.

## Build and lint commands

```bash
npm run build   # production build + type check
npm run lint    # ESLint
npx tsc --noEmit # TypeScript type check
npm run test    # Vitest test suite
```

## Primary-source signal ingestion

The unified PostgreSQL `signals` table is populated by nine adapters in
`src/lib/ingestion/` across the UK, US and EU:

| Jurisdiction | Adapters |
| --- | --- |
| UK | Find a Tender, Planning Data, Companies House |
| US | USAspending, SAM.gov, SEC EDGAR |
| EU | TED SPARQL, TED API, EU Open Data |

Free sources run without credentials. Keyed adapters self-disable when their
environment variables are absent (`COMPANIES_HOUSE_API_KEY`, `SAM_GOV_API_KEY`,
`TED_EU_API_KEY`). Apply the schema first, then run a cycle:

```bash
npx tsx scripts/apply-schema.ts
npm run ingest:signals:once   # single cycle
npm run ingest:signals        # 15-minute background loop
```

Each row is keyed by a SHA-256 `source_hash`, so repeated runs are idempotent
and duplicates are ignored.

## Project structure

```
src/
  app/              # Next.js App Router routes
    layout.tsx      # Root layout + metadata
    page.tsx        # Landing page (server component)
    globals.css     # Tailwind v4 + design tokens
  app/dashboard/    # Dashboard routes
    page.tsx        # Market Intelligence workstation
    opportunities/  # Tender pipeline grid
    opportunities/[id]/  # Opportunity detail page
    map/            # Global geospatial map
    pipeline/       # Deal tracking pipeline
    alerts/         # Active monitors
    saved/          # Saved tenders
    integrations/   & CRM sync
    profile/        # Unified profile, billing, API, security
    billing/        & settings (redirect to /dashboard/profile)
    settings/       (redirect to /dashboard/profile)
  components/
    ui/             # shadcn/ui primitives
    dashboard-navigation.tsx   # Top navigation
    executive-kpi-header.tsx   # KPI metrics bar
    live-ticker.tsx            # Intelligence stream ticker
    opportunities-table.tsx    # High-density tender table
    deal-pipeline-panel.tsx    # Deal tracking panel
    empty-state.tsx            # Elegant empty state UI
    cookie-banner.tsx          # Cookie consent banner
  lib/
    env.ts          # Server environment validation
    db.ts           # PostgreSQL pool, queries and transactions
    redis.ts        # Redis with PostgreSQL / memory fallback
    backend.ts      # Server-to-server API client for the Vercel frontend
    auth.ts         # Authentication helpers
    config/         # Central configuration
      index.ts      # Central config barrel
      sectors.ts    # 15 supported sectors
      regions.ts    # 7 region codes
      plans.ts      # Free and Pro commercial plans
    entitlements.ts # Free/Pro entitlement system
    tier-gating.ts  # Free vs Pro tier enforcement
    rate-limit.ts   # Sliding-window rate limiter
    webhooks.ts     # Outbound webhook dispatch with SSRF protection
    nvidia.ts       # NVIDIA AI extraction client
    logger.ts       # Structured JSON logging
    opportunities.ts # Server-side opportunity service
    ingestion/      # Primary-source adapters + background ingestion runner
    alerts.ts       # Alert dispatch service
    email-delivery.ts # Email delivery abstraction
  types/
    index.ts        # Shared types
worker/
  src/
    adapters/       # 18 source adapters (3 per country × 6 jurisdictions)
    pipeline/       # Ingestion pipeline stages
    utils/hash.ts   # SHA-256 provenance utilities
    types/index.ts  # Worker shared types
    index.ts        # Worker entry point
    health.ts       # Worker health check
```

## Features

### Core Capabilities

- **18 ingestion adapters** across 6 jurisdictions:
  - **UK**: Contracts Finder, Find a Tender, Scotland PCS
  - **US**: SAM.gov, USAspending.gov, DLA DIBBS
  - **Canada**: CanadaBuys, MERX, Provincial portals
  - **Ireland**: eTenders, OGP frameworks, ESB/TII semi-state
  - **Australia**: AusTender, State procurement, Defence
  - **EU**: TED, eProcurement, EDA

- **Strict CPV-based sector filtering** — only core commercial sectors are ingested (Infrastructure, Energy, Defence, Technology, Logistics). All other public sector noise is dropped before reaching the database.

- **SHA-256 provenance** — every ingested record carries an immutable source hash for zero-hallucination traceability.

- **Canonical ID deduplication** — idempotent upsert prevents duplicate records across re-ingestion runs.

- **Free vs Pro tier enforcement** — server-side entitlement checks on all protected operations. Free users: limited/truncated detail fields, no exports, no map data, 10 opportunities/day, 1 sector filter. Pro users: full dossiers, buyer emails where lawful, CSV/JSON exports, alerts, map, full value details.

### Dashboard Routes

- `/dashboard` — Market Intelligence workstation with KPI header, live ticker, priority tenders table, deal pipeline panel
- `/dashboard/opportunities` — Ultra-dense tabular data grid with quick filter shortcuts
- `/dashboard/opportunities/[id]` — Tender detail page with provenance and forensics
- `/dashboard/map` — Full-screen dark map view (Pro only)
- `/dashboard/pipeline` — Deal-tracking Kanban/list layout
- `/dashboard/alerts` — Rule-based monitoring (Pro only)
- `/dashboard/saved` — Saved tenders pipeline
- `/dashboard/integrations` — Webhook dispatch and CRM sync (Pro only)
- `/dashboard/profile` — Unified profile, billing, API & integrations, security manager

### Architecture

- **Web app**: Next.js 16 App Router, React 19, TypeScript strict
- **Backend**: PostgreSQL 16 (auth, records) + Redis (cache/sessions, optional)
- **Ingestion worker**: Separate Node.js project polling 18 source adapters every 15 minutes
- **Billing**: Stripe (checkout + webhooks with idempotency)
- **AI extraction**: NVIDIA API for structured procurement data extraction
- **Deployment**: Vercel frontend + FastHost VPS backend (Docker, Caddy, standalone output)

## Security

- Server components by default; client components only where required
- Strict TypeScript; no `any` types
- No API keys or credentials are invented or hard-coded
- Secrets are never exposed in client-side code
- Administrator credentials are server-only (no `NEXT_PUBLIC` prefix)
- SSRF protection on outbound webhook dispatch
- CSRF protection on auth mutation endpoints
- Sliding-window rate limiting on auth and opportunities endpoints
- SHA-256 source provenance for all ingested records
- Semantic HTML, accessible labels and visible focus states

## Verified working

- TypeScript type check: clean (web + worker)
- ESLint: clean (0 errors)
- Production build: clean (45 routes)
- Tests: 44 passed across 4 test files
- All dashboard routes: redirect to signin when unauthenticated
- All API routes: functional with proper authentication
- API health: `/api/health` (HTTP 200)
- Security headers: CSP, HSTS (HTTPS), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy

## Commands to start

1. PostgreSQL + Redis: follow [Local PostgreSQL setup](#local-postgresql-setup)
2. Web app: `npm run dev` (opens http://localhost:3000)
3. Worker: `cd worker && npm run ingest -- --once` (single run) or `npm run dev` (15-min polling)
4. Worker health: `cd worker && npm run health`