<<<<<<< HEAD
# Dockerfile for SourceSignal — prepared for Coolify deployment.
FROM node:24-alpine AS base

# 1. Install dependencies only when needed
=======
﻿FROM node:24-alpine AS base
>>>>>>> origin/main
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

<<<<<<< HEAD
# 2. Rebuild the source code only when needed
=======
>>>>>>> origin/main
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

<<<<<<< HEAD
# 3. Production image, copy all the files and run Next.js
=======
>>>>>>> origin/main
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
<<<<<<< HEAD

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

=======
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
>>>>>>> origin/main
CMD ["node", "server.js"]
