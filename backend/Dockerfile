# SourceSignal Backend — Multi-stage optimized Dockerfile for Node.js/Fastify
#
# Stage 1: deps    — install production dependencies only
# Stage 2: builder — compile TypeScript to JavaScript
# Stage 3: runner  — lean runtime image (non-root, API by default; worker via compose)
#
# Build:
#   docker build -t sourcesignal-api:latest .
#
# Run:
#   docker run -p 3001:3001 --env-file .env sourcesignal-api:latest

# ---------------------------------------------------------------------------
# Stage 1: Dependencies (production only)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

# Install production dependencies only (faster, smaller layer)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2: Builder (full install for TypeScript compilation)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Full install needed for TypeScript compilation + type checking
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to dist/
RUN npx tsc

# ---------------------------------------------------------------------------
# Stage 3: Runner — lean production runtime (non-root user)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sourceuser && \
    chown -R sourceuser:nodejs /app

USER sourceuser

# Copy compiled output + production node_modules
COPY --from=deps --chown=sourceuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sourceuser:nodejs /app/dist ./dist

# Migrations (applied separately via init container / migration job — read-only)
COPY --chown=sourceuser:nodejs migrations ./migrations

EXPOSE 3001

# Default command runs the Fastify API.
# The background worker is launched via docker-compose command override.
CMD ["node", "dist/index.js"]
