-- SourceSignal — Canonical database schema (migration 001)
--
-- Enables uuid-ossp and creates the core tables:
--   users, organisations, memberships, signals, user_subscriptions, cache_entries
--
-- Run against PostgreSQL 16 (directly or via PgBouncer).
-- Idempotent: safe to re-run on existing databases.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(255),
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  country_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  country        VARCHAR(2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatible column additions for existing databases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'country_preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN country_preferences JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'country'
  ) THEN
    ALTER TABLE users ADD COLUMN country VARCHAR(2);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organisations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(255) UNIQUE NOT NULL,
  plan           VARCHAR(50) NOT NULL DEFAULT 'free',
  country        VARCHAR(2),
  owner_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_customer_id VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatible column additions for existing databases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'plan'
  ) THEN
    ALTER TABLE organisations ADD COLUMN plan VARCHAR(50) NOT NULL DEFAULT 'free';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'country'
  ) THEN
    ALTER TABLE organisations ADD COLUMN country VARCHAR(2);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE organisations ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE organisations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE organisations ADD COLUMN stripe_customer_id VARCHAR(255);
  END IF;
END $$;

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
-- user_subscriptions (Stripe-backed subscription records)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_tier         VARCHAR(50) NOT NULL DEFAULT 'free',
  status            VARCHAR(50) NOT NULL DEFAULT 'inactive',
  stripe_subscription_id VARCHAR(255),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Unique constraint on content_hash for idempotent re-ingestion via ON CONFLICT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'signals'::regclass
      AND contype = 'u'
      AND conname = 'signals_content_hash_key'
  ) THEN
    ALTER TABLE signals ADD CONSTRAINT signals_content_hash_key UNIQUE (content_hash);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- cache_entries (shared cache / session fallback for Redis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cache_entries (
  key        VARCHAR(255) PRIMARY KEY,
  value      TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_signals_org_id ON signals(organisation_id);
CREATE INDEX IF NOT EXISTS idx_signals_content_hash ON signals(content_hash);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_organisations_owner_id ON organisations(owner_id);
