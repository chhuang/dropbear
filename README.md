# DropBear 🐨

Australian real estate price drop tracker. Catches falling prices like a drop bear.

## Overview

Tracks Sydney property listings and detects price drops in real-time.

## Tech Stack

- **Supabase** - PostgreSQL database
- **Apify** - Web scraping (via Puppeteer actors)
- **Domain.com.au** - Data source

## Target Suburbs

- Burwood 2134
- Chatswood 2067
- More coming soon

## How It Works

1. Scrape listings daily via Apify actors
2. Store in Supabase with price history
3. Detect price drops automatically
4. Alert on significant drops

## Setup

```bash
cd dropbear
npm install
# Copy .env.local.example to .env.local and fill in Supabase credentials
# For Apify, you need to set APIFY_TOKEN in .env.local
```

---

Updated: 2026-03-16
