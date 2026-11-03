# Ingestion worker image.
#
# NOTE: the worker currently writes to PocketBase, not PostgreSQL. It is
# included so the VPS stack is complete, but keep it disabled until the
# PocketBase -> PostgreSQL migration lands.
FROM node:24-alpine

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
