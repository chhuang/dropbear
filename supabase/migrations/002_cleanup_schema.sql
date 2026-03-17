-- Migration: Cleanup schema - remove is_active, add batch support
-- Run in Supabase SQL Editor

-- 1. Remove is_active column (use last_seen_at for freshness)
ALTER TABLE listings DROP COLUMN IF EXISTS is_active;

-- 2. Ensure last_seen_at exists
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Update apify_runs for batch scraping support
ALTER TABLE apify_runs ADD COLUMN IF NOT EXISTS apify_run_id TEXT;
ALTER TABLE apify_runs ADD COLUMN IF NOT EXISTS postcode TEXT;

-- 4. Migrate existing run_id to apify_run_id
UPDATE apify_runs SET apify_run_id = run_id WHERE apify_run_id IS NULL AND run_id IS NOT NULL;

-- 5. Drop old run_id column if exists
ALTER TABLE apify_runs DROP COLUMN IF EXISTS run_id;

-- 6. Add indexes for batch queries
CREATE INDEX IF NOT EXISTS idx_apify_runs_apify_run_id ON apify_runs(apify_run_id);
CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen_at DESC);

-- 7. Add comments
COMMENT ON COLUMN listings.last_seen_at IS 'When this listing was last seen in a scrape (use for freshness)';
COMMENT ON COLUMN apify_runs.apify_run_id IS 'Apify run ID - shared when multiple suburbs scraped in one batch';
