# SourceSignal Implementation Status

## Design System — Tesla x SpaceX Industrial Minimalism

### Applied Design Directives:
- **Canvas**: Pure matte black (`#000000`) throughout
- **Cards**: Black with crisp 1px `rgba(255,255,255,0.2)` borders
- **Typography**: Inter (sans) + JetBrains Mono (mono); weights 400/500 only
- **Text**: Spectral white (`#ffffff`) primary, muted zinc (`#71717A`) secondary
- **Technical data**: UPPERCASE + `tracking-[0.12em]` for hashes, CTAs, kickers
- **Monospace**: Numbers, timestamps, coordinates, SHA-256 hashes in JetBrains Mono
- **Zero decoration**: No drop shadows, gradients, glows, blur panels, rounded corners
- **Buttons**: Primary = solid white bg / black text, 0px radius. Secondary = ghost border
- **Navigation**: Frosted backdrop (`backdrop-blur-md`), no drop-shadows
- **Layout**: High-density grid lines, 1px borders, telemetry-style stat callouts

## Phase A — PocketBase foundation
- [x] PocketBase migrations directory with collection schemas (3 migration files)
- [x] Users / auth collection configuration (PocketBase built-in)
- [x] Organisations/workspaces collection
- [x] Memberships collection (user-to-organisation links)
- [x] Opportunities collection (title, summary, buyer, sector, region, dates, value, stage, source URL, canonical ID, confidence, structured details)
- [x] Source records / source snapshots collection
- [x] Provenance and extraction metadata collection
- [x] Saved opportunities collection (owner-scoped)
- [x] Alerts collection (owner-scoped)
- [x] Alert delivery records collection
- [x] Subscription state collection
- [x] Ingestion runs and ingestion errors collection
- [x] Processed webhooks collection (webhook idempotency)
- [x] Field validation and indexes
- [x] Unique constraints / deduplication strategy (canonical ID + source hash)
- [x] Collection access rules (public vs owner-scoped vs admin)
- [x] Setup and migration procedure documented (pb_migrations/README.md)
- [x] Local PocketBase startup command documented

## Phase B — Authentication and application shell
- [x] Sign up page (/auth/signup) — dark aesthetic
- [x] Sign in page (/auth/signin) — dark aesthetic
- [x] Sign out action (/api/auth/signout)
- [x] Session restoration via pb_auth cookie + authRefresh
- [x] Protected dashboard routes (middleware.ts with secure headers)
- [x] Server-verified user identity for privileged operations (lib/auth.ts)
- [x] CSRF protection via Origin header checks on mutation endpoints
- [x] Rate limiting on /api/auth/signin and /api/auth/signup (10 req/min)
- [x] Password rules: min 10 chars, mixed-case, digits
- [x] Auth error and loading states
- [x] Profile / preferences / account settings (dashboard/settings)
- [x] Auth redirects (callbackUrl)
- [x] Application shell navigation (Overview, Opportunities, Saved, Alerts, Map, Integrations, Settings, Billing)
- [x] Overview dashboard with aggregate metrics from real data
- [x] Empty states (no fabricated metrics)
- [x] Opportunity discovery API (search, sector/region filters, date/stage filters, sort, pagination)
- [x] Opportunity listing page UI (dashboard/opportunities) — dark telemetry table
- [x] Opportunity detail page UI (dashboard/opportunities/[id]) — dark with provenance + forensics
- [x] Saved opportunities page UI (dashboard/saved) — dark
- [x] Alerts page UI (dashboard/alerts) — dark, Pro gate
- [x] Settings page UI (dashboard/settings) — dark
- [x] Billing page UI (dashboard/billing) — dark
- [x] Integrations page UI (dashboard/integrations) — webhook + CRM config

## Phase C — Entitlements and data security
- [x] Central typed entitlement system (lib/entitlements.ts)
- [x] Server-side entitlement checks on all protected operations
- [x] Free plan: limited/truncated detail fields, no exports, no map data
- [x] Pro plan: full dossiers, buyer emails where lawful, CSV/JSON exports, alerts, map
- [x] No trusting client-supplied plan/user IDs (verified from org membership)
- [x] Cross-user access prevention (owner-scoped relations)
- [x] Input validation and field constraint
- [x] Sanitized opportunity responses (restricted fields stripped server-side)
- [x] Rate limiting on /api/opportunities (60 req/min) and /api/auth/* (10 req/min)
- [x] Tests for Free/Pro differences and unauthorised access (tests/entitlements.test.ts)

## Phase D — Ingestion and intelligence pipeline
- [x] Node.js ingestion worker (separate project at /worker)
- [x] Configurable 15-minute polling interval
- [x] Source-adapter interface (BaseSourceAdapter)
- [x] Demonstration adapter (clearly marked, no live data)
- [x] Documented process for adding adapters (registry.ts)
- [x] Timeouts, bounded retries, backoff
- [x] Safe handling of malformed responses (normalise returns null)
- [x] Structured logs via lib/logger.ts (no credentials)
- [x] Recovery from interrupted runs (idempotent upsert)
- [x] Manual ingestion command (npm run ingest -- --once)
- [x] Worker health check (worker/src/health.ts)
- [x] Worker typed PocketBase auth (no `as any` cast)
- [x] SHA-256 source snapshots and provenance (worker/src/utils/hash.ts)
- [x] Canonicalisation and deduplication (worker/src/pipeline/canonicalise.ts)
- [x] Idempotent upsert into PocketBase (worker/src/pipeline/upsert.ts)

## Phase E — NVIDIA AI extraction
- [x] NVIDIA config in env.ts (getNvidiaConfig)
- [x] Server-side NVIDIA API integration (lib/nvidia.ts)
- [x] Configurable model and endpoint
- [x] Structured JSON output with strict schema validation
- [x] Distinction between source facts, inferred summaries, unknowns
- [x] No inference of buyer email, value, date, award status without evidence
- [x] Record model ID, extraction timestamp, source hash, extraction status
- [x] Rate limit, timeout, malformed JSON, outage handling
- [x] Bounded safe retries with exponential backoff
- [x] Credentials out of browser/logs/commits/responses
- [x] Deterministic mock extraction for tests only (labelled as fixtures)
- [x] Subcontractor & winner forensics parsing (subcontractors, winningBidder fields)
- [x] Tests for extraction validation (tests/hash-and-extraction.test.ts)

## Phase F — Stripe Pro subscriptions
- [x] Stripe config in env.ts (getStripeConfig)
- [x] Checkout session creation (/api/stripe/checkout)
- [x] Success and cancellation return routes
- [x] Verified webhook signature handling (/api/stripe/webhook)
- [x] Idempotent event processing (persisted to processed_webhooks collection)
- [x] Subscription lifecycle states (completed, updated, deleted, payment_failed)
- [x] Stripe customer/subscription ID mapped to PocketBase user/organisation
- [x] Server-side entitlement synchronisation (plan field updated on org)
- [x] Billing UI with actual known subscription state
- [x] Stripe keys and price ID via env vars
- [x] Setup state when Stripe not configured (paid access locked)
- [x] Webhook tests with signed test events/fixtures (tests/stripe-webhook.test.ts)

## Phase G — Saved opportunities and alerts
- [x] Save/unsave API (/api/saved-opportunities, [id])
- [x] Alert CRUD API (/api/alerts, [id])
- [x] Saved opportunities page UI (dashboard/saved) — dark
- [x] Alerts page UI (dashboard/alerts) — dark, Pro gate
- [x] Idempotent alert evaluation API (/api/alerts/evaluate)
- [x] No duplicate alerts for same event (dedup via alert_deliveries)
- [x] Email delivery abstraction (lib/email-delivery.ts)
- [x] Persistent delivery queue/status
- [x] Delivery status honesty (queued vs delivered)
- [x] Alert recipient lookup via expanded user relation

## Phase H — 3D opportunity map (/dashboard/map)
- [x] Route at /dashboard/map only
- [x] Lazy loading with fallback (React.lazy + Suspense)
- [x] Three.js / React Three Fiber NOT loaded for Free users
- [x] Free users: upgrade gate without loading 3D library (server-enforced)
- [x] Geographic visualisation of opportunities (equirectangular projection)
- [x] Sector/region data in map points
- [x] Hover/selection details
- [x] Accessible alternative list/table view
- [x] Loading, empty, error, missing-coordinate states
- [x] Mobile fallback (responsive table view)
- [x] Server-authorised map data (API fetch with entitlements)
- [x] No fabricated coordinates

## Phase I — CSV/JSON exports
- [x] Server-authorised exports API (/api/exports/[format])
- [x] Only permitted fields exported (based on real plan from org membership)
- [x] CSV escaping and formula injection protection
- [x] Valid JSON output with documented schema
- [x] Free users denied with 403
- [x] Tests for entitlement-based field access (tests/entitlements.test.ts)

## Phase J — PWA and production readiness
- [x] Dockerfile (standalone output, non-root, port 3000)
- [x] .dockerignore (excludes secrets, env files)
- [x] Environment variable validation (lib/env.ts — PocketBase creds required at startup)
- [x] next.config.ts output: standalone
- [x] Web app manifest (public/manifest.json)
- [x] Health check endpoint (/api/health)
- [x] Structured logging (lib/logger.ts — JSON structured, sanitizes secrets)
- [x] Secure production headers (middleware.ts — CSP, HSTS, X-Frame-Options, etc.)
- [x] Worker as separate process (/worker project)
- [x] Coolify documentation updated (docs/coolify-deployment.md)

## Phase K — Quality, testing and completion
- [x] Lint passes (0 errors, 1 warning)
- [x] TypeScript type check passes (web + worker)
- [x] Production build passes (25 routes)
- [x] All routes prerender successfully
- [x] Test framework configured (vitest)
- [x] Unit tests written and passing (44 tests across 4 files)
- [x] Tests: sector/region config, entitlements, hash/provenance, AI extraction, Stripe webhook
- [x] Final security review (headers, secrets sanitization, no client-exposed secrets)
- [x] Design redesign — Tesla x SpaceX industrial minimalism applied across all components

## PART 3 — Next-Level B2B Intelligence Engines
- [x] Subcontractor & Winner Forensics Engine — NVIDIA extraction parses subcontractors/winning bidder from tender text
- [x] One-tap preset dashboard filters (>£1M CapEx, Direct B2B Leads, Live Today, UK / US Only)
- [x] Verifiable SHA-256 Provenance Viewer — provenance card on opportunity detail page
- [x] Webhook & CRM Sync for Pro subscribers — /api/webhooks/dispatch + /dashboard/integrations

## Verified working
- Landing page: http://localhost:3000 (HTTP 200)
- Sign in: http://localhost:3000/auth/signin (HTTP 200)
- Sign up: http://localhost:3000/auth/signup (HTTP 200)
- All dashboard routes: redirect to signin when unauthenticated (307)
- API routes: /api/auth/[action], /api/opportunities, /api/opportunities/[id]
- API routes: /api/saved-opportunities, /api/saved-opportunities/[id]
- API routes: /api/alerts, /api/alerts/[id], /api/alerts/evaluate
- API routes: /api/exports/csv, /api/exports/json (401 when unauthenticated)
- API routes: /api/stripe/checkout, /api/stripe/webhook, /api/webhooks/dispatch
- API health: /api/health (HTTP 200)
- Security headers: CSP, HSTS (HTTPS), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy
- TypeScript strict mode: clean (web + worker)
- ESLint: clean (0 errors, 1 warning)
- Production build: clean (25 routes)
- Worker typecheck: clean
- Worker health check: functional
- Tests: 44 passed across 4 test files

## Commands to start
1. PocketBase: `./pocketbase serve --http=127.0.0.1:8090` then `./pocketbase migrate`
2. Web app: `npm run dev` (opens http://localhost:3000)
3. Worker: `cd worker && npm run ingest -- --once` (single run) or `npm run dev` (15-min polling)
4. Worker health: `cd worker && npm run health`

## Next manual actions
1. Create PocketBase admin account via UI at http://127.0.0.1:8090/_/
2. Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in .env
3. Run `./pocketbase migrate` to apply migrations (includes processed_webhooks collection)
4. Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_PRO for Pro billing
5. Configure NVIDIA_API_KEY, NVIDIA_API_BASE_URL, NVIDIA_MODEL for AI extraction
