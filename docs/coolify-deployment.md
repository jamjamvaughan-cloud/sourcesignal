# Deployment — Coolify

SourceSignal is prepared for deployment on [Coolify](https://coolify.io), the
self-hosted Heroku/Netlify alternative. Nothing is installed inside the
application project and nothing is deployed automatically — this document
describes the approach to use when you are ready to deploy.

## Prerequisites

- A running Coolify instance (self-hosted or managed) — set up separately,
  not inside this project.
- A PocketBase instance reachable from the application (Coolify can host this
  as another service/resource).
- The `NEXT_PUBLIC_POCKETBASE_URL` pointing at your PocketBase instance.
- Server-only admin credentials: `POCKETBASE_ADMIN_EMAIL` and
  `POCKETBASE_ADMIN_PASSWORD`.

## What is in the project

- `Dockerfile` — multi-stage Node.js build producing a Next.js standalone
  server image.
- `.dockerignore` — excludes secrets, local env files, node_modules and build
  output from the image.
- `next.config.ts` — `output: "standalone"` so the container runs `server.js`
  directly.
- `.env.example` — template of the environment variables required.
- `src/middleware.ts` — route protection + secure headers.
- `src/lib/logger.ts` — structured JSON logging.
- `worker/` — separate ingestion worker project (15-minute polling).

## Deployment approach

1. Push this repository to a Git provider (GitHub/GitLab/Gitea).
2. In Coolify, add a new project and connect the repository.
3. Add a new "Service" of type "Dockerfile" pointing at the `Dockerfile`.
   - Build context: repository root
   - Dockerfile: `./Dockerfile`
   - Port: `3000`
4. Add a second service/resource for the ingestion worker:
   - Build context: `./worker`
   - Command: `npm run dev` (or `npm run ingest -- --once` for one-off runs)
   - The worker MUST run as a separate process from the web application.
5. Set the following environment variables in Coolify (never in the repo):
   - `NEXT_PUBLIC_POCKETBASE_URL` — e.g. `https://pb.example.com`
   - `POCKETBASE_ADMIN_EMAIL` — server-only admin email
   - `POCKETBASE_ADMIN_PASSWORD` — server-only admin password
   - `STRIPE_SECRET_KEY` — Stripe secret key (for Pro billing)
   - `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
   - `STRIPE_PRICE_ID_PRO` — Stripe price ID for Pro plan
   - `NVIDIA_API_KEY` — NVIDIA API key (for AI extraction)
   - `NVIDIA_API_BASE_URL` — NVIDIA API endpoint
   - `NVIDIA_MODEL` — NVIDIA model identifier
   - `SERVICE_NAME` — service name for structured logging
6. Deploy. Coolify builds the image and exposes port `3000`.
7. Point your domain at the Coolify service and configure TLS.

## Secrets

No secrets or administrator credentials are hard-coded in this project. All
secrets are supplied as environment variables at deploy time through Coolify,
and `.env*` files are excluded from version control via `.gitignore` and
`.dockerignore`.

## Local Docker verification

```bash
# Web application
docker build -t sourcesignal .
docker run -p 3000:3000 --env-file .env sourcesignal

# Ingestion worker (separate container)
cd worker
docker build -t sourcesignal-worker .
docker run --env-file ../.env sourcesignal-worker npm run ingest -- --once
```

## PocketBase persistence

PocketBase data is stored in its local data directory (typically `./pb_data`
relative to the PocketBase executable). When hosting PocketBase on Coolify:

- Mount a persistent volume at the PocketBase data directory.
- Back up the volume regularly (see backup/restore below).
- Do not run PocketBase as a sidecar in the same container as the web app.

## Backup and restoration

PocketBase data:
- Back up: copy the PocketBase data directory (`pb_data/`) to offsite storage.
- Restore: stop PocketBase, replace `pb_data/` with the backup, restart.

Application state:
- No application state is stored on disk (all data is in PocketBase).
- Environment variables are stored in Coolify's encrypted secret store.

## Worker process

The ingestion worker runs as a separate process from the web application.
It polls configured sources every 15 minutes and writes results to
PocketBase. Do not run the worker in the same container as the web app.
