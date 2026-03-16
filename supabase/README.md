# DropBear Supabase Migration

## Setup

1. Go to https://supabase.com and create a new project
2. Project name: `dropbear`
3. Database password: (save this somewhere safe)
4. Region: Choose closest to Sydney (Southeast Asia - Singapore is closest)

## Get Credentials

After project is created, go to:
- Settings → API
- Copy these values:
  - Project URL
  - anon public key
  - service_role key (for server-side operations)

## Schema

Run the SQL in `supabase/schema.sql` via:
- SQL Editor in Supabase dashboard, OR
- `psql` connection

## Tables Created

| Table | Purpose |
|-------|---------|
| `suburbs` | Suburbs to track |
| `listings` | Property listings with current state |
| `price_history` | Every price observation |
| `drops` | Detected price drops |
| `scrape_runs` | Scrape run history |

## Views Created

| View | Purpose |
|------|---------|
| `listings_with_drops` | Listings with aggregated drop info |
| `suburb_stats` | Stats per suburb |

## Next Steps

1. Create project on Supabase
2. Run schema.sql
3. Add credentials to Rook HQ
4. Update scraper to use Supabase instead of Convex
