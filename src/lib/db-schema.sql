-- SourceSignal Native PostgreSQL 16 Schema (Enterprise Production Aligned)
-- Idempotent: safe to re-run against an existing database.
-- Apply with: npx tsx scripts/apply-schema.ts

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organisations Table
CREATE TABLE IF NOT EXISTS organisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free' NOT NULL,
    country VARCHAR(10) DEFAULT 'UK',
    owner_id UUID NOT NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free' NOT NULL,
    organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add owner foreign key to organisations after users table exists
ALTER TABLE organisations
    DROP CONSTRAINT IF EXISTS fk_organisations_owner;
ALTER TABLE organisations
    ADD CONSTRAINT fk_organisations_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Memberships Table
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_org_user UNIQUE (organisation_id, user_id)
);

-- 4. Adapters Table
CREATE TABLE IF NOT EXISTS adapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    source_domain VARCHAR(255) NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    summary TEXT,
    issuing_authority VARCHAR(255),
    buyer VARCHAR(255),
    buyer_canonical_id VARCHAR(255),
    location VARCHAR(255),
    country VARCHAR(10) NOT NULL DEFAULT 'UK',
    sector VARCHAR(100) NOT NULL DEFAULT 'other',
    region VARCHAR(100),
    signal_tier VARCHAR(20) NOT NULL DEFAULT 'standard',
    est_deal_value BIGINT,
    estimated_value NUMERIC(15, 2),
    budget_amount NUMERIC(15, 2),
    currency VARCHAR(10) DEFAULT 'GBP',
    procurement_stage VARCHAR(100),
    published_date TIMESTAMP WITH TIME ZONE,
    closing_date TIMESTAMP WITH TIME ZONE,
    confidence NUMERIC(5, 2),
    source_url TEXT,
    source_name TEXT,
    source_domain VARCHAR(255),
    source_captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source_hash VARCHAR(255) UNIQUE,
    source_snapshot TEXT,
    signal_source_type VARCHAR(50),
    vulnerability_trigger VARCHAR(100),
    detail_fields JSONB,
    cpv_code VARCHAR(50),
    is_demonstration BOOLEAN DEFAULT FALSE NOT NULL,
    winner VARCHAR(255),
    raw_payload JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Saved Opportunities Table
CREATE TABLE IF NOT EXISTS saved_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_opportunity UNIQUE (user_id, opportunity_id)
);

-- 7. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    query_filters JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Alert Deliveries Table
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    provider VARCHAR(100),
    external_id VARCHAR(255),
    response_status INT,
    error_message TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Ingestion Runs Table
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adapter_id UUID REFERENCES adapters(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'running' NOT NULL,
    records_processed INT DEFAULT 0,
    signals_processed INT DEFAULT 0,
    retry_count INT DEFAULT 0,
    error_message TEXT,
    payload JSONB,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 10. Ingestion Errors Table
CREATE TABLE IF NOT EXISTS ingestion_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adapter_id UUID REFERENCES adapters(id) ON DELETE SET NULL,
    run_id UUID REFERENCES ingestion_runs(id) ON DELETE CASCADE,
    error_message TEXT,
    error_details TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Processed Webhooks Table (Stripe Idempotency)
CREATE TABLE IF NOT EXISTS processed_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Webhook Deliveries Table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    webhook_url TEXT,
    event_type VARCHAR(100),
    payload JSONB DEFAULT '{}',
    provider VARCHAR(100),
    external_id VARCHAR(255),
    response_status INT,
    error_message TEXT,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Rate Limit Windows Table
CREATE TABLE IF NOT EXISTS rate_limit_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL,
    identifier VARCHAR(255),
    request_count INT DEFAULT 1 NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_rate_limit_key UNIQUE (key)
);

-- 14. Cache Entries Table (Redis fallback / session store)
CREATE TABLE IF NOT EXISTS cache_entries (
    key VARCHAR(512) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);

-- ============================================================================
-- Application compatibility upgrades
-- Adds columns the SourceSignal app queries to databases created from earlier
-- versions of this schema. All statements are additive and idempotent.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_preferences TEXT[] DEFAULT ARRAY['UK'];
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry_preferences TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS subcategory_preferences TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free' NOT NULL;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'UK';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS created_by UUID;
UPDATE organisations
   SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(id::text, 1, 8)
 WHERE slug IS NULL;
ALTER TABLE organisations ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_slug ON organisations(slug);

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS canonical_id VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS buyer VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS buyer_canonical_id VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'UK';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sector VARCHAR(100) DEFAULT 'other';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS signal_tier VARCHAR(20) DEFAULT 'standard';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS est_deal_value BIGINT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS signal_source_type VARCHAR(50);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(15, 2);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS procurement_stage VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS published_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS confidence NUMERIC(5, 2);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_domain VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_hash VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_snapshot TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS vulnerability_trigger VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS detail_fields JSONB;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cpv_code VARCHAR(50);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_demonstration BOOLEAN DEFAULT FALSE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS winner VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_type TEXT DEFAULT 'PROCUREMENT';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_score INT DEFAULT 50;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS commercial_why TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS supplier_capabilities TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sub_category TEXT;
UPDATE opportunities SET canonical_id = id::text WHERE canonical_id IS NULL;
ALTER TABLE opportunities ALTER COLUMN canonical_id SET NOT NULL;
ALTER TABLE opportunities ALTER COLUMN country SET DEFAULT 'UK';
ALTER TABLE opportunities ALTER COLUMN sector SET DEFAULT 'other';
ALTER TABLE opportunities ALTER COLUMN signal_tier SET DEFAULT 'standard';
ALTER TABLE opportunities ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE opportunities ALTER COLUMN is_demonstration SET DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_canonical_id ON opportunities(canonical_id);

ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS records_processed INT DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS signals_processed INT DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE ingestion_errors ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES ingestion_runs(id) ON DELETE CASCADE;
ALTER TABLE ingestion_errors ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE ingestion_errors ADD COLUMN IF NOT EXISTS error_details TEXT;
ALTER TABLE ingestion_errors ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE processed_webhooks ADD COLUMN IF NOT EXISTS event_type VARCHAR(255);
ALTER TABLE processed_webhooks ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
UPDATE processed_webhooks SET processed_at = created_at WHERE processed_at IS NULL;

ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS provider VARCHAR(100);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS response_status INT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE rate_limit_windows ADD COLUMN IF NOT EXISTS key VARCHAR(255);
ALTER TABLE rate_limit_windows ADD COLUMN IF NOT EXISTS reset_at TIMESTAMP WITH TIME ZONE;
UPDATE rate_limit_windows SET key = identifier WHERE key IS NULL AND identifier IS NOT NULL;
ALTER TABLE rate_limit_windows ALTER COLUMN identifier DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_windows_key ON rate_limit_windows(key);

ALTER TABLE alert_deliveries ADD COLUMN IF NOT EXISTS provider VARCHAR(100);
ALTER TABLE alert_deliveries ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE alert_deliveries ADD COLUMN IF NOT EXISTS response_status INT;
ALTER TABLE alert_deliveries ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 15. Entity Profiles (Multi-Source Entity Resolution / De-duplication)
-- Clusters related signals (planning permit + job posting + company filing)
-- under a single Unified Commercial Target Profile with aggregated deal value.
CREATE TABLE IF NOT EXISTS entity_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
    canonical_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    sector VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(10) DEFAULT 'UK',
    aggregated_deal_value BIGINT DEFAULT 0,
    signal_count INT DEFAULT 0,
    highest_tier VARCHAR(20) DEFAULT 'STANDARD_COMMERCIAL',
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_entity_slug UNIQUE (slug)
);

-- 16. Entity Profile Members (links signals/opportunities to entity profiles)
CREATE TABLE IF NOT EXISTS entity_profile_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_profile_id UUID NOT NULL REFERENCES entity_profiles(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    match_reason VARCHAR(255),
    match_confidence NUMERIC(3, 2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_entity_opportunity UNIQUE (entity_profile_id, opportunity_id)
);

-- 17. Webhook Subscriptions (Zero CRM Bloat & Frictionless Hand-Off)
-- Allows users to register webhook URLs to stream high-intent signals
-- directly to Slack, Teams, Zapier, Make, or their own tech stack.
-- No CRM lock-in — data flows out via standard webhooks.
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    event_types JSONB DEFAULT '["opportunity.created"]' NOT NULL,
    min_tier VARCHAR(20) DEFAULT 'STANDARD_COMMERCIAL' NOT NULL,
    min_confidence NUMERIC(3, 2) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    total_deliveries INT DEFAULT 0,
    failed_deliveries INT DEFAULT 0,
    last_delivery_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Webhook Deliveries (delivery tracking for webhook subscriptions)
-- Persists delivery attempts so users can audit and retry failed webhooks.
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    http_status INT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org ON webhook_subscriptions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_sub ON webhook_delivery_logs(webhook_subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_status ON webhook_delivery_logs(status);

-- 19. Signal Rules (Custom Keyword & Territory Signal Rules)
-- Allows users to set personalized alert routing profiles based on
-- geographical jurisdiction and target contract value ranges.
CREATE TABLE IF NOT EXISTS signal_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    keywords JSONB DEFAULT '[]' NOT NULL,
    territories JSONB DEFAULT '[]' NOT NULL,
    min_value BIGINT,
    max_value BIGINT,
    min_tier VARCHAR(20) DEFAULT 'STANDARD_COMMERCIAL',
    vulnerability_triggers JSONB DEFAULT '[]' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    match_count INT DEFAULT 0,
    last_matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Signal Rule Matches (tracks which signals matched which rules)
CREATE TABLE IF NOT EXISTS signal_rule_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_rule_id UUID NOT NULL REFERENCES signal_rules(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_signal_rule_match UNIQUE (signal_rule_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_signal_rules_org ON signal_rules(organisation_id);
CREATE INDEX IF NOT EXISTS idx_signal_rules_user ON signal_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_rules_active ON signal_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_signal_rule_matches_rule ON signal_rule_matches(signal_rule_id);
CREATE INDEX IF NOT EXISTS idx_signal_rule_matches_opp ON signal_rule_matches(opportunity_id);

-- 21. User Subscriptions (Multi-Currency Stripe Billing)
-- Stores per-user subscription details including currency, amount, and plan tier.
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    amount_total BIGINT,
    plan_tier VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'incomplete',
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_entity_profiles_slug ON entity_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_entity_profiles_org ON entity_profiles(organisation_id);
CREATE INDEX IF NOT EXISTS idx_entity_profile_members_entity ON entity_profile_members(entity_profile_id);
CREATE INDEX IF NOT EXISTS idx_entity_profile_members_opp ON entity_profile_members(opportunity_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON memberships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organisations_owner_id ON organisations(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_buyer_canonical ON opportunities(buyer_canonical_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_sector ON opportunities(sector);
CREATE INDEX IF NOT EXISTS idx_opportunities_region ON opportunities(region);
CREATE INDEX IF NOT EXISTS idx_opportunities_country ON opportunities(country);
CREATE INDEX IF NOT EXISTS idx_opportunities_signal_tier ON opportunities(signal_tier);
CREATE INDEX IF NOT EXISTS idx_opportunities_closing_date ON opportunities(closing_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user ON saved_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON alert_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_adapter ON ingestion_runs(adapter_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_adapter ON ingestion_errors(adapter_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_windows_start ON rate_limit_windows(window_start);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Idempotent Triggers for updated_at
DROP TRIGGER IF EXISTS update_organisations_updated_at ON organisations;
CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON opportunities;
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_adapters_updated_at ON adapters;
CREATE TRIGGER update_adapters_updated_at BEFORE UPDATE ON adapters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 21. Unified Primary Signals
-- Normalised records from UK/US/EU primary-source ingestion adapters.
-- source_hash is a SHA-256 of (adapter, jurisdiction, source, source ID) and
-- is unique so repeated ingestion cycles are idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_sector') THEN
        CREATE TYPE signal_sector AS ENUM (
            'TECH',
            'ENERGY',
            'HEALTHCARE',
            'PUBLIC_SECTOR',
            'CONSTRUCTION',
            'TRANSPORT',
            'LOGISTICS'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_opportunity_type') THEN
        CREATE TYPE signal_opportunity_type AS ENUM (
            'PROJECT',
            'PROCUREMENT',
            'EXPANSION',
            'COMPLIANCE',
            'POLICY'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    jurisdiction VARCHAR(10) NOT NULL
        CHECK (jurisdiction IN ('UK', 'US', 'EU')),
    sector signal_sector NOT NULL,
    opportunity_type signal_opportunity_type NOT NULL,
    estimated_value NUMERIC(18, 2),
    source_name VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    source_hash VARCHAR(64) NOT NULL UNIQUE,
    commercial_why TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    -- Cryptographic provenance columns (Part 2).
    -- raw_payload_json preserves the exact adapter payload for audit.
    -- audit_snapshot_html is a rendered, immutable snapshot of the signal.
    -- sha256_hash is the content-addressed SHA-256 proof of the raw payload.
    raw_payload_json JSONB,
    audit_snapshot_html TEXT,
    sha256_hash VARCHAR(64) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_published_at ON signals(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_jurisdiction ON signals(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_signals_sector ON signals(sector);
CREATE INDEX IF NOT EXISTS idx_signals_opportunity_type ON signals(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_signals_source_name ON signals(source_name);

ALTER TABLE signals ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS raw_payload_json JSONB;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS audit_snapshot_html TEXT;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_signals_sha256_hash ON signals(sha256_hash);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signals_sha256_hash_key') THEN
        ALTER TABLE signals ADD CONSTRAINT signals_sha256_hash_key UNIQUE (sha256_hash);
    END IF;
END $$;

-- 22. Outbound Webhook Destinations
-- User-scoped webhook endpoints that receive signed signals in real time.
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    sector_filters TEXT[] DEFAULT '{}' NOT NULL,
    min_value NUMERIC(18, 2),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);

-- 23. Alert / Webhook Delivery Logs
-- Persisted record of every outbound delivery attempt for audit & retry.
CREATE TABLE IF NOT EXISTS alert_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL,
    response_status_code INT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_webhook ON alert_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_signal ON alert_logs(signal_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_attempted_at ON alert_logs(attempted_at DESC);
