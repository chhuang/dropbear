const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

// Batch 2 - restarted after abort
const searchUrls = [
  'https://www.domain.com.au/sale/eastwood-nsw-2122/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/roseville-nsw-2069/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/pymble-nsw-2073/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/north-sydney-nsw-2060/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/manly-nsw-2095/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/wolli-creek-nsw-2205/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/gordon-nsw-2072/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/surry-hills-nsw-2010/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/willoughby-nsw-2068/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/killara-nsw-2071/?excludeunderoffer=1&ssubs=0',
]

async function run() {
  console.log('Starting batch 2 scrape (retry) for 10 suburbs...')
  
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrls,
        proxyConfiguration: { useApifyProxy: true }
      })
    }
  )
  
  const runData = await startRes.json()
  const runId = runData.data?.id
  console.log('Run ID:', runId)
  return runId
}

run()
