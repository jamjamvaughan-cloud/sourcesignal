# Deployment — Vercel frontend + FastHost VPS backend

SourceSignal runs as two deployments of the same repository:

| Tier | Host | Responsibility |
|---|---|---|
| Frontend | Vercel (`app.sourcesignal.site`) | Next.js UI, SSR shell, `/api/*` proxy to the VPS |
| Backend | FastHost VPS (`api.sourcesignal.site`) | Next.js API routes, PostgreSQL, PgBouncer, Redis, Caddy, ingestion worker |

Vercel holds **no** database, Redis, Stripe or NVIDIA credentials. All data and
secrets stay on the VPS.

```
Browser
  │  https://app.sourcesignal.site
  ▼
Vercel (Next.js frontend)
  │  /api/* rewrite → https://api.sourcesignal.site/api/*
  ▼
Caddy (TLS) → Next.js API → PgBouncer → PostgreSQL
                              └────────→ Redis
Stripe ── webhook ──────────→ https://api.sourcesignal.site/api/stripe/webhook
```

Because the browser only ever talks to `app.sourcesignal.site`, the session
cookie stays first-party. The Vercel rewrite forwards the cookie to the VPS,
and server components forward it again on server-to-server calls.

---

## 1. DNS

Create these records at your DNS provider:

| Type | Name | Value | Purpose |
|---|---|---|---|
| `CNAME` | `app` | `cname.vercel-dns.com` | Vercel frontend |
| `A` | `api` | `<VPS public IPv4>` | VPS API + Caddy |

Remove any conflicting `A`/`AAAA` records for those names. DNS must resolve
before Caddy can issue a certificate.

---

## 2. VPS preparation

Assumes Ubuntu 24.04 and a fresh FastHost VPS.

```bash
# As root: create a deploy user and copy your SSH key
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/

# Harden SSH (disable password auth) in /etc/ssh/sshd_config:
#   PasswordAuthentication no
#   PermitRootLogin no
systemctl restart ssh

# Firewall: only SSH, HTTP and HTTPS
apt update && apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Log out and back in as `deploy`.

```bash
sudo mkdir -p /opt/sourcesignal
sudo chown deploy:deploy /opt/sourcesignal
git clone https://github.com/jamjamvaughan-cloud/sourcesignal.git /opt/sourcesignal
cd /opt/sourcesignal
```

### Secrets

```bash
cp .env.production.example .env
chmod 600 .env

# Generate hex secrets (no URL-encoding needed)
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # REDIS_PASSWORD
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # WEBHOOK_SIGNING_SECRET
```

Edit `.env`:

- Set `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`.
- Set `DATABASE_URL` and `REDIS_URL` to use the **same** passwords.
- Set `NEXT_PUBLIC_APP_URL=https://app.sourcesignal.site`.
- Set `APP_ORIGIN=https://app.sourcesignal.site`.
- Add Stripe and NVIDIA credentials.
- **Leave `BACKEND_URL` unset.**

### Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

The API container waits for PgBouncer and Redis health checks. Caddy obtains a
TLS certificate for `api.sourcesignal.site` automatically once DNS resolves.

### Apply the database schema (first deploy)

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U sourcesignal -d sourcesignal_db < src/lib/db-schema.sql
```

The schema is idempotent (`CREATE TABLE IF NOT EXISTS`).

### Verify

```bash
curl -fsS https://api.sourcesignal.site/api/health
docker compose -f docker-compose.prod.yml logs -f api
```

---

## 3. Vercel frontend

1. Import the GitHub repository into Vercel.
2. Framework preset: **Next.js**. Root directory: repository root.
3. Build command: `npm run build`. Install command: `npm ci`.
4. Add these Environment Variables (Production and Preview):

   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | `https://api.sourcesignal.site` |
   | `NEXT_PUBLIC_APP_URL` | `https://app.sourcesignal.site` |
   | `APP_ORIGIN` | `https://app.sourcesignal.site` |

   Do **not** add `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, Stripe or NVIDIA
   keys to Vercel.

5. Add the domain `app.sourcesignal.site`.
6. Deploy.

`next.config.ts` reads `BACKEND_URL` at build time and registers an external
rewrite:

```
/api/:path* → https://api.sourcesignal.site/api/:path*
```

When `BACKEND_URL` is unset (the VPS deployment), no rewrite is registered and
the API routes are served by the local Next.js process.

---

## 4. Stripe

Point the Stripe webhook at the VPS directly (not through Vercel):

```
https://api.sourcesignal.site/api/stripe/webhook
```

Recommended events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` in `/opt/sourcesignal/.env`
and restart the API:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

The legacy alias `/api/webhooks/stripe` exists for compatibility; use
`/api/stripe/webhook` for new endpoints.

---

## 5. Backups

PostgreSQL is the only durable application state (Redis is a cache and can be
rebuilt; Caddy certificates can be re-issued).

```bash
# /opt/sourcesignal/backup.sh
#!/usr/bin/env bash
set -euo pipefail
cd /opt/sourcesignal
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p /var/backups/sourcesignal
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U sourcesignal -d sourcesignal_db -Fc \
  > "/var/backups/sourcesignal/db-${STAMP}.dump"
find /var/backups/sourcesignal -type f -mtime +14 -delete
```

```bash
chmod +x /opt/sourcesignal/backup.sh
# Daily at 03:15 UTC
echo "15 3 * * * deploy /opt/sourcesignal/backup.sh" | sudo tee /etc/cron.d/sourcesignal-backup
```

Copy `/var/backups/sourcesignal` to off-site storage (S3, Backblaze, another
host) or the backup is only as good as the VPS disk.

Restore:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U sourcesignal -d sourcesignal_db --clean --if-exists \
  < /var/backups/sourcesignal/db-YYYYMMDDTHHMMSSZ.dump
```

---

## 6. Updating

VPS backend:

```bash
cd /opt/sourcesignal
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

Frontend: push to GitHub; Vercel builds and deploys automatically.

Keep the VPS and Vercel in sync by deploying from the same commit.

---

## 7. Security notes

- Only Caddy publishes host ports (`80`, `443`). PostgreSQL (`5432`),
  PgBouncer (`6432`) and Redis (`6379`) are `expose`d to the Docker network
  only — never `ports`.
- All passwords are supplied through `.env`, which is gitignored and mounted
  only into the containers that need it.
- Vercel never receives database or payment credentials.
- Auth mutations enforce an `Origin` allow-list (`APP_ORIGIN` plus the
  request's forwarded host), so the Vercel → VPS proxy hop works without
  weakening CSRF checks.
- `/api/auth/*` and `/api/opportunities` are rate-limited by client IP
  (`x-forwarded-for`, set by Caddy and Vercel).

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `502` from `api.sourcesignal.site` | API container unhealthy. `docker compose logs api`; check `DATABASE_URL`/`REDIS_URL` hosts. |
| Caddy cannot issue a certificate | DNS for `api` is missing or still propagating; port 80/443 blocked by the firewall. |
| `401 Not authenticated` after sign-in | Cookie not forwarded. Confirm the Vercel rewrite is active (`BACKEND_URL` set **before** build) and `APP_ORIGIN` matches the browser origin. |
| `403 CSRF token mismatch` | `APP_ORIGIN` or `NEXT_PUBLIC_APP_URL` does not match `https://app.sourcesignal.site`. |
| Stripe webhook `400` | `STRIPE_WEBHOOK_SECRET` on the VPS does not match the endpoint in Stripe. |
| Dashboard loads but is empty | API is reachable but the database has no rows; see the ingestion blocker below. |

---

## 9. Known blocker: ingestion worker

The ingestion worker still writes to **PocketBase**
(`worker/src/pipeline/upsert.ts`), while the web app reads **PostgreSQL**
(`src/lib/db.ts`). The worker is therefore behind the optional `ingestion`
Compose profile and disabled by default:

```bash
docker compose -f docker-compose.prod.yml --profile ingestion up -d worker
```

Until the worker is migrated to PostgreSQL, it will not populate the data shown
by the frontend. That migration is the next backend task.
