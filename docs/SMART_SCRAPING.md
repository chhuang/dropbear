# Smart Scraping Strategy

## Rules

1. **Never scrape a suburb twice in 7 days**
2. **Prioritize by listing count** (more listings = more price drop opportunities)
3. **Skip suburbs with <5 listings** (low value)
4. **Batch: 12-15 suburbs per day max** to stay within $29/mo

## Budget Math

- $29/mo plan = ~$0.14 per run
- Safe budget: ~200 runs/month = ~7 runs/day
- But we can burst: 15 runs/day = 450/month if we rest other days

## Priority Formula

```
Priority Score = listing_count × (days_since_last_scrape / 7)
```

High listings + stale = high priority

## How to Use

1. Run: `npx tsx scripts/smart-scrape-recommend.ts`
2. Get list of suburbs to scrape
3. Run those through Apify
4. Repeat daily

## Tracking

Suburb last-scraped dates tracked in:
- `apify_runs` table (started_at field)
- Query: `SELECT suburb, MAX(started_at) as last_scrape FROM apify_runs GROUP BY suburb`
