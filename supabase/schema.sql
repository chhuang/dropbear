-- DropBear Schema
-- Run in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Listings table (current state of each property)
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id BIGINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'domain',
  suburb TEXT NOT NULL,
  address TEXT,
  initial_price BIGINT,
  current_price BIGINT,
  price_text TEXT,
  bedrooms INT,
  bathrooms INT,
  car_spaces INT,
  property_type TEXT,
  url TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT listings_source_listing_id_unique UNIQUE (source, listing_id)
);

-- Price history (audit trail)
CREATE TABLE IF NOT EXISTS listings_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id BIGINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'domain',
  price BIGINT,
  price_text TEXT,
  observed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apify runs tracking (supports batch scraping)
CREATE TABLE IF NOT EXISTS apify_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apify_run_id TEXT NOT NULL,
  suburb TEXT NOT NULL,
  postcode TEXT NOT NULL,
  dataset_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  listings_found INT DEFAULT 0,
  listings_new INT DEFAULT 0,
  error TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_listings_suburb ON listings(suburb);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(current_price) WHERE current_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_listing ON listings_price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_price_history_observed ON listings_price_history(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_apify_runs_suburb ON apify_runs(suburb);
CREATE INDEX IF NOT EXISTS idx_apify_runs_started ON apify_runs(started_at DESC);

-- Comments
COMMENT ON TABLE listings IS 'Current state of each property listing';
COMMENT ON TABLE listings_price_history IS 'Every price observation over time';
COMMENT ON TABLE apify_runs IS 'Scrape run tracking - one row per suburb (batch runs share apify_run_id)';
COMMENT ON COLUMN listings.initial_price IS 'First price we ever saw for this listing';
COMMENT ON COLUMN listings.current_price IS 'Most recent price from latest scrape';
COMMENT ON COLUMN listings.last_seen_at IS 'When this listing was last seen in a scrape (use for freshness)';
COMMENT ON COLUMN apify_runs.apify_run_id IS 'Apify run ID - shared when multiple suburbs scraped in one batch';
