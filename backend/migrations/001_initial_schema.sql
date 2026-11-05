-- SourceSignal — Canonical database schema (migration 001)
--
-- Enables uuid-ossp and creates the core tables:
--   users, organisations, memberships, signals
--
-- Run against PostgreSQL 16 (directly or via PgBouncer).

-- ---------------------------------------------------------------------------
# Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name    VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organisations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memberships (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role              VARCHAR(50),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_org UNIQUE (user_id, organisation_id)
);

-- ---------------------------------------------------------------------------
-- signals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title          VARCHAR(500) NOT NULL,
  source_url     TEXT,
  content_hash   VARCHAR(64) NOT NULL,
  raw_payload    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_signals_org_id ON signals(organisation_id);
CREATE INDEX IF NOT EXISTS idx_signals_content_hash ON signals(content_hash);

-- ---------------------------------------------------------------------------
-- Helpful index for membership lookups (authz)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(organisation_id);
