-- Migration: Multi-platform property detection
-- Run this in Supabase SQL Editor

-- 1. Drop existing single-column unique constraint
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_listing_id_key;

-- 2. Add composite unique constraint (source + listing_id)
ALTER TABLE listings ADD CONSTRAINT listings_source_listing_id_unique UNIQUE (source, listing_id);

-- 3. Verify
SELECT 
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint 
WHERE conrelid = 'listings'::regclass;
