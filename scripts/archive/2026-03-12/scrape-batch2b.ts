const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

// Missing suburbs from batch 2 (aborted run)
const searchUrls = [
  'https://www.domain.com.au/sale/north-sydney-nsw-2060/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/manly-nsw-2095/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/wolli-creek-nsw-2205/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/gordon-nsw-2072/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/willoughby-nsw-2068/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/killara-nsw-2071/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/surry-hills-nsw-2010/?excludeunderoffer=1&ssubs=0',  // re-scrape for full data
]

async function run() {
  console.log('Starting batch 2b scrape for 7 missing/partial suburbs...')
  
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
  
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    const statusData = await statusRes.json()
    const status = statusData.data?.status
    
    console.log(`[${(i+1)*5}s] ${status}`)
    
    if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data?.defaultDatasetId
        console.log('Dataset ID:', datasetId)
        
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
        )
        const items = await itemsRes.json()
        console.log('\nTotal results:', items.length, 'items')
        
        const bySuburb: Record<string, number> = {}
        for (const item of items) {
          const url = item.searchUrl || ''
          let suburb = 'unknown'
          if (url.includes('north-sydney')) suburb = 'north sydney'
          else if (url.includes('manly')) suburb = 'manly'
          else if (url.includes('wolli-creek')) suburb = 'wolli creek'
          else if (url.includes('gordon')) suburb = 'gordon'
          else if (url.includes('willoughby')) suburb = 'willoughby'
          else if (url.includes('killara')) suburb = 'killara'
          else if (url.includes('surry-hills')) suburb = 'surry hills'
          bySuburb[suburb] = (bySuburb[suburb] || 0) + 1
        }
        console.log('\nBy suburb:')
        for (const [s, c] of Object.entries(bySuburb)) {
          console.log(`  ${s}: ${c}`)
        }
      } else {
        console.log('Run ended:', status, statusData.data?.statusMessage)
      }
      return { runId, datasetId: statusData.data?.defaultDatasetId }
    }
  }
}

run()
