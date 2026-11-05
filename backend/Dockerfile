# SourceSignal Backend — Multi-stage optimized Dockerfile for Node.js/TypeScript
#
# Stage 1: deps    — install production dependencies only
# Stage 2: builder — compile TypeScript to JavaScript
# Stage 3: runner  — lean runtime image (API by default; worker via compose override)

# ---------------------------------------------------------------------------
# Stage 1: Dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

# Install production dependencies only (faster, smaller layer)
COPY package.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Full install needed for TypeScript compilation
COPY package.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to dist/
RUN npx tsc

# ---------------------------------------------------------------------------
# Stage 3: Runner
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sourceuser && \
    chown -R sourceuser:nodejs /app
USER sourceuser

# Copy compiled output + production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Migrations (applied separately via init container / migration job)
COPY migrations ./migrations

EXPOSE 3001

# Default command runs the Fastify API.
# The background worker is launched via docker-compose command override.
CMD ["node", "dist/src/index.js"]
