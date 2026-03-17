# DropBear

NSW real estate price drop tracker. Catches falling prices like a drop bear.

**Inspired by:** https://www.panicselling.xyz/dubai/

---

## Overview

```
Domain.com.au → Apify (scrape) → Supabase (store) → Price Drop Detection
```

Track property listings and detect price drops over time.

---

## Tech Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Scraping | Apify EasyApi | Scrape Domain.com.au |
| Database | Supabase | Store listings & price history |
| Frontend | Next.js | Web interface (port 3002) |

---

## Database Schema

### listings (current state)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| listing_id | bigint | Extracted from Domain URL |
| source | text | Default: "domain" |
| suburb | text | e.g. "burwood" |
| address | text | Full address |
| initial_price | bigint | First price ever seen (nullable) |
| current_price | bigint | Latest price (nullable) |
| price_text | text | Raw price text from Domain |
| bedrooms | int | |
| bathrooms | int | |
| car_spaces | int | |
| property_type | text | apartment, house, etc. |
| url | text | Domain.com.au URL |
| first_seen_at | timestamptz | When we first saw this listing |
| last_seen_at | timestamptz | When we last saw this listing |

**Note:** Use `last_seen_at` to determine if a listing is still active. Old `last_seen_at` = listing disappeared.

### listings_price_history (audit trail)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| listing_id | bigint | FK to listings |
| source | text | Default: "domain" |
| price | bigint | Observed price (nullable) |
| price_text | text | Raw price text |
| observed_at | timestamptz | Auto-generated |

Every scrape writes to this table, even if price is same/null.

### apify_runs (scrape tracking)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| apify_run_id | text | Apify run ID (shared in batch) |
| suburb | text | |
| postcode | text | |
| dataset_id | text | Apify dataset ID |
| started_at | timestamptz | |
| finished_at | timestamptz | |
| status | text | running/completed/failed |
| listings_found | int | |
| listings_new | int | |
| error | text | |

**Batch support:** When scraping multiple suburbs in one Apify run, each suburb gets its own row with the same `apify_run_id`.

---

## Scraping

### URL Format (MANDATORY)

```
https://www.domain.com.au/sale/{suburb}-{state}-{postcode}/?excludeunderoffer=1&ssubs=0
```

| Param | Value | Purpose |
|-------|-------|---------|
| excludeunderoffer | 1 | Exclude properties under offer |
| ssubs | 0 | **CRITICAL** - Exclude surrounding suburbs |

Example:
```
https://www.domain.com.au/sale/burwood-nsw-2134/?excludeunderoffer=1&ssubs=0
```

### Apify Configuration

| Key | Value |
|-----|-------|
| Actor ID | ErD1Yvg2Mvhxo0qCx (EasyApi) |
| Max Items | 50000 |
| Proxy | Apify Proxy (required) |

### Scripts

| Script | Purpose |
|--------|---------|
| scripts/apify-scrape.ts | Unified scraper: validate → scrape → sync → detect drops |
| scripts/utils/ | Ad-hoc query scripts (check-stale, check-drops, etc.) |

Usage:
```bash
# Validation only (free, no Apify call)
npx tsx scripts/apify-scrape.ts --dry-run burwood 2134 NSW

# Single suburb
npx tsx scripts/apify-scrape.ts burwood 2134 NSW

# Batch mode (multiple suburbs, one Apify run - saves money!)
npx tsx scripts/apify-scrape.ts --batch burwood:2134 chatswood:2067 manly:2095
```

---

## Sync Logic

### Listing ID Extraction

Extract from Domain URL:
```
https://www.domain.com.au/...-2018221234 → listing_id = 2018221234
```

### Price Parsing Rules

| Input | Output | Notes |
|-------|--------|-------|
| $1,250,000 | 1250000 | Standard format |
| Guide $4,500,000 | 4500000 | Strip prefix |
| $700,000 - $720,000 | 700000 | Use LOW end of range |
| $1.5m / $1.5M | 1500000 | Convert units |
| $500k / $500K | 500000 | Convert units |
| Auction | null | No price available |
| Contact Agent | null | No price available |
| Price on request | null | No price available |
| 0412345678 | null | Phone number, skip |
| Any value < $10,000 | null | Likely not a price |

### Sync Flow

```
For each item from Apify:
  1. Extract listing_id from URL
  2. Parse price using rules above
  3. Detect suburb from item data
  
  4. If listing EXISTS in DB:
     - Update current_price
     - Update price_text
     - Update last_seen_at = NOW()
     - Write to price_history (always)
     - Check for drop: current < initial
  
  5. If listing is NEW:
     - Insert with initial_price = current_price
     - Set first_seen_at = NOW()
     - Set last_seen_at = NOW()
     - Write to price_history (always)
```

### No-Price Listings

- Store with null price - Do not skip
- Reason: Track existence, detect when price appears later
- Still write to price_history with null price

### Determining Active Listings

A listing is "active" if it appeared in a recent scrape:
```sql
SELECT * FROM listings 
WHERE last_seen_at > NOW() - INTERVAL '7 days'
```

---

## Price Drop Detection

### Definition

A drop = current_price < initial_price

- initial_price = first price we ever saw for this listing
- current_price = latest price from most recent scrape

**Note:** We can only detect drops AFTER we start tracking. Historical drops before our first scrape are invisible.

---

## Smart Scraping Strategy

### Rules

| Rule | Reason |
|------|--------|
| Never scrape same suburb within 7 days | Wastes money |
| Skip suburbs with <5 listings | Low value |
| Use batch mode for multiple suburbs | Saves money (one Apify run) |

### Budget Math

- $29/mo plan = ~$0.14 per run
- Batch mode: 10 suburbs in 1 run = $0.14 (vs $1.40 for 10 separate runs)
- Safe budget: ~200 runs/month

### Priority Formula

```
Priority Score = listing_count × (days_since_last_scrape / 7)
```

Higher listings + stale data = higher priority

---

## Cost Management

### Apify Pricing

- ~$0.14 per scrape run
- Dataset retained for ~7 days
- Batch mode strongly recommended for multiple suburbs

---

## Configuration

### Environment Variables

| Key | Location | Purpose |
|-----|----------|---------|
| APIFY_TOKEN | Project .env.local | Apify API authentication |
| SUPABASE_URL | Hardcoded in scripts | Supabase endpoint |
| SUPABASE_KEY | Hardcoded in scripts | Supabase anon key |

### Files

| Path | Purpose |
|------|---------|
| scripts/cron-scrape.ts | Main scraper (single + batch) |
| scripts/safe-scrape.ts | Validation-only scraper |
| scripts/utils/ | Ad-hoc query scripts |
| web/ | Next.js frontend |
| supabase/ | Schema migrations |

---

## Current Status

| Component | Status |
|-----------|--------|
| Database schema | Ready (pending migration) |
| Scraping scripts | Ready |
| Sync logic | Ready |
| Drop detection | Ready |
| Batch support | Ready |
| Web frontend | Not running |
| Cron automation | Not scheduled |

---

## Next Steps

1. Run migration: `supabase/migrations/002_cleanup_schema.sql`
2. Test batch scrape: `npx tsx scripts/cron-scrape.ts --batch burwood:2134 chatswood:2067`
3. Verify drop detection works
4. Set up cron jobs (after testing)

---

Last updated: 2026-03-17
