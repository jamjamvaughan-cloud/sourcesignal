-- Migration 002: Reconcile missing tables, enums, and column drift
-- Run after 001_initial_schema.sql. Idempotent where possible.

BEGIN;

-- 1. Enable pgcrypto for gen_random_uuid() used in new tables
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create missing custom ENUM types (values match ingestion adapter output)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_sector') THEN
    CREATE TYPE signal_sector AS ENUM (
      'TECH', 'ENERGY', 'HEALTHCARE', 'PUBLIC_SECTOR',
      'CONSTRUCTION', 'TRANSPORT', 'LOGISTICS'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_opportunity_type') THEN
    CREATE TYPE signal_opportunity_type AS ENUM (
      'PROJECT', 'PROCUREMENT', 'EXPANSION', 'COMPLIANCE', 'POLICY'
    );
  END IF;
END $$;

-- 3. Add missing Stripe fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_status VARCHAR(50) DEFAULT 'inactive';

-- 4. Reconcile signals table column drift (align with frontend API SELECTs)
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sector signal_sector,
  ADD COLUMN IF NOT EXISTS opportunity_type signal_opportunity_type,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS source_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS commercial_why TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NOW();

-- Make organisation_id nullable so the ingestion worker can insert
-- global/scraped signals without a matching organisation row.
ALTER TABLE signals ALTER COLUMN organisation_id DROP NOT NULL;

-- 5. Create missing peripheral tables referenced by API routes
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  sector_filters JSONB DEFAULT '[]'::jsonb,
  min_value NUMERIC(15, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_webhooks (
  id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  provider VARCHAR(50) DEFAULT 'webhook',
  external_id TEXT,
  response_status INT,
  error_message TEXT,
  status VARCHAR(50),
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  region VARCHAR(100),
  country VARCHAR(2),
  aggregated_deal_value NUMERIC(15, 2) DEFAULT 0,
  signal_count INT DEFAULT 0,
  highest_tier VARCHAR(50) DEFAULT 'STANDARD_COMMERCIAL',
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_profile_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id UUID NOT NULL REFERENCES entity_profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  match_reason VARCHAR(100),
  match_confidence NUMERIC(3, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  keywords JSONB DEFAULT '[]'::jsonb,
  territories JSONB DEFAULT '[]'::jsonb,
  min_value NUMERIC(15, 2),
  max_value NUMERIC(15, 2),
  min_tier VARCHAR(50) DEFAULT 'STANDARD_COMMERCIAL',
  vulnerability_triggers JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  match_count INT DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_rule_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_rule_id UUID NOT NULL REFERENCES signal_rules(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved opportunities (user bookmarks)
CREATE TABLE IF NOT EXISTS saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_signal UNIQUE (user_id, signal_id)
);

COMMIT;
