# Dockerfile for SourceSignal — prepared for Coolify deployment.
#
# Coolify can deploy this directly by pointing at this repository.
# No secrets are baked into the image; provide environment variables via
# Coolify's environment-variable panel at deploy time.
#
# Build:
#   docker build -t sourcesignal .
# Run:
#   docker run -p 3000:3000 --env-file .env sourcesignal

FROM node:24-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Production image, copy all the files and run Next.js
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user to run the app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# PocketBase URL must be supplied at runtime via environment (Coolify env vars)
CMD ["node", "server.js"]
