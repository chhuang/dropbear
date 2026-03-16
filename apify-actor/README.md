# Domain.com.au Scraper

Custom Apify Actor for scraping property listings from Domain.com.au.

## Features

- ✅ **No rental fee** - Your own actor, just pay for compute (~$0.05/run vs $0.14 + $15/mo)
- ✅ **Apify Proxy** - Uses residential proxies (included in your $29/mo plan)
- ✅ **Compatible output** - Same format as EasyApi actor
- ✅ **Anti-bot bypass** - Playwright + proxy rotation

## Input

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| suburb | string | ✅ | - | Suburb name (e.g., "Chatswood") |
| postcode | string | ✅ | - | Australian postcode (e.g., "2067") |
| state | string | ❌ | nsw | State code (nsw, vic, qld, etc.) |
| maxPages | integer | ❌ | 0 | Max pages to scrape (0 = all) |
| excludeUnderOffer | boolean | ❌ | true | Exclude under offer listings |

## Output

Returns an array of property listings:

```json
{
  "listing_id": 1234567890,
  "url": "https://www.domain.com.au/123-sample-st-chatswood-nsw-2067-1234567890",
  "price": 1500000,
  "price_text": "$1,500,000",
  "address": "123 Sample St, Chatswood NSW 2067",
  "suburb": "chatswood",
  "postcode": "2067",
  "state": "NSW",
  "bedrooms": 4,
  "bathrooms": 2,
  "car_spaces": 2,
  "property_type": null,
  "image_url": "https://..."
}
```

## Deploy to Apify

```bash
# Install Apify CLI
npm install -g apify-cli

# Login
apify login

# Create actor (first time)
cd apify-actor
apify create --template=project-empty

# Push to Apify
apify push

# Run
apify run -i '{"suburb": "chatswood", "postcode": "2067"}'
```

## Local Testing

```bash
cd apify-actor
npm install

# Run with test input
APIFY_LOCAL_STORAGE_DIR=./storage node src/main.js
```

## Cost Comparison

| Option | Monthly | Per Run |
|--------|---------|---------|
| EasyApi rental | $15 + compute | ~$0.14 |
| **This actor** | $0 | ~$0.05-0.08 |

**Savings: ~$15/month or ~$180/year**

## Limitations

- Doesn't visit individual listing pages (faster but less detail)
- No agent phone numbers (would need detail page)
- No land size or full property type

For full details, you'd need to visit each listing URL separately.
