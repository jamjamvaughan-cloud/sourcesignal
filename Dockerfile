# Dockerfile for SourceSignal — VPS backend deployment.
#
# Builds the Next.js API/frontend bundle. On the VPS it runs behind Caddy and
# serves the /api routes; the public frontend is deployed separately on Vercel.
FROM node:24-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public values are inlined into the client bundle at build time.
# Server-only values (DATABASE_URL, JWT_SECRET, Stripe, etc.) are supplied at
# runtime through the container environment and never baked into the image.
ARG NEXT_PUBLIC_APP_URL
ARG APP_ORIGIN
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV APP_ORIGIN=${APP_ORIGIN}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 3. Production image, copy all the files and run Next.js
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
