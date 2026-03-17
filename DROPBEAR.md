# DropBear

NSW real estate price drop tracker. Catches falling prices like a drop bear.

**Inspired by:** https://www.panicselling.xyz/dubai/

---

## Overview

```
Domain.com.au → Apify (scrape) → Supabase (store) → Price Drop Detection
```

Track Sydney property listings and detect price drops over time.

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
| listing_id | bigint | Extracted from Domain URL, unique |
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
| is_active | boolean | False if not in latest scrape |
| first_seen_at | timestamptz | |
| last_seen_at | timestamptz | |

### listings_price_history (audit trail)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| listing_id | bigint | FK to listings |
| price | bigint | Observed price (nullable) |
| price_text | text | Raw price text |
| observed_at | timestamptz | Auto-generated |

Every scrape writes to this table, even if price is same/null.

### apify_runs (scrape tracking - optional)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| suburb | text | |
| run_id | text | Apify run ID |
| dataset_id | text | Apify dataset ID |
| started_at | timestamptz | |
| finished_at | timestamptz | |
| status | text | running/completed/failed |
| listings_found | int | |
| error | text | |

---

## Scraping

### URL Format (MANDATORY)

```
https://www.domain.com.au/sale/{suburb}-{state}-{postcode}/?excludeunderoffer=1&ssubs=0
```

| Param | Value | Purpose |
|-------|-------|---------|
| excludeunderoffer | 1 | Exclude properties under offer |
| ssubs | 0 | Exclude surrounding suburbs |

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
| scripts/safe-scrape.ts | Validate URL + start Apify run (no sync) |
| scripts/cron-scrape.ts | Full pipeline: scrape → wait → sync → detect drops |

Usage:
```bash
# Validation only (free)
npx tsx scripts/safe-scrape.ts burwood 2134 NSW --dry-run

# Start scrape only
npx tsx scripts/safe-scrape.ts burwood 2134 NSW

# Full pipeline (recommended)
npx tsx scripts/cron-scrape.ts burwood 2134 NSW
```

---

## Sync Logic

### Listing ID Extraction

Extract from Domain URL:
```
https://www.domain.com.au/2018221234 → listing_id = 2018221234
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
  
  3. If listing EXISTS in DB:
     - Update current_price
     - Update price_text
     - Set is_active = true
     - Write to price_history (always)
     - Check for drop: current < initial
  
  4. If listing is NEW:
     - Insert with initial_price = current_price
     - Write to price_history (always)
  
  5. Mark listings not in scrape as is_active = false
```

### No-Price Listings

- Store with null price - Do not skip
- Reason: Track existence, detect when price appears later
- Still write to price_history with null price

---

## Price Drop Detection

### Definition

A drop = current_price < initial_price

- initial_price = first price ever seen for this listing
- current_price = latest price from most recent scrape

### Detection Scripts

| Script | Purpose |
|--------|---------|
| check-drops.ts | Find ALL listings with drops |
| check-new-drops.ts | Find drops from recent sync (last hour) |

Note: Drops are detected during sync in cron-scrape.ts.

---

## Suburbs

### Active (to be scraped)

| Suburb | Postcode | State |
|--------|----------|-------|
| burwood | 2134 | NSW |
| chatswood | 2067 | NSW |
| parramatta | 2150 | NSW |
| liverpool | 2170 | NSW |
| manly | 2095 | NSW |
| bondi | 2026 | NSW |
| cronulla | 2230 | NSW |
| castle hill | 2154 | NSW |
| kogarah | 2217 | NSW |
| potts point | 2011 | NSW |

### Adding New Suburbs

1. Verify URL works: npx tsx safe-scrape.ts <suburb> <postcode> NSW --dry-run
2. Run first scrape: npx tsx cron-scrape.ts <suburb> <postcode> NSW
3. Add to active list above

---

## Cost Management

### Apify Pricing

- ~$0.14 per scrape run
- Dataset retained for ~7 days

### Smart Scraping Rules

| Rule | Reason |
|------|--------|
| Never scrape same suburb within 7 days | Wastes money |
| Skip suburbs with <5 listings | Low value |
| Max 12-15 suburbs/day | Stay within $29/mo budget |

### Priority Formula

```
Priority Score = listing_count x (days_since_last_scrape / 7)
```

Higher listings + stale data = higher priority

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
| /root/.openclaw/workspace/projects/dropbear/ | Project root |
| scripts/ | Scraping & sync scripts |
| web/ | Next.js frontend |
| supabase/ | Schema migrations |

---

## Current Status

| Component | Status |
|-----------|--------|
| Database schema | Ready |
| Scraping scripts | Ready |
| Sync logic | Ready |
| Drop detection | Ready |
| Web frontend | Not running |
| Cron automation | Not scheduled |
| Notifications | Not implemented |

---

## Next Steps

1. Start web frontend
2. Test scrape + sync on one suburb
3. Verify drop detection works
4. Set up cron jobs (after manual testing complete)

---

Last updated: 2026-03-17
