const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const searchUrls = [
  'https://www.domain.com.au/sale/vaucluse-nsw-2030/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/rose-bay-nsw-2029/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/bellevue-hill-nsw-2023/?excludeunderoffer=1&ssubs=0',
]

async function run() {
  console.log('Starting batch scrape for 3 suburbs...')
  console.log('URLs:', searchUrls)
  
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
  
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 5000))
    
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    const statusData = await statusRes.json()
    const status = statusData.data?.status
    
    console.log(`[${(i+1)*5}s] ${status}`)
    
    if (status === 'SUCCEEDED' || status === 'FAILED') {
      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data?.defaultDatasetId
        console.log('Dataset ID:', datasetId)
        
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
        )
        const items = await itemsRes.json()
        console.log('\nTotal results:', items.length, 'items')
        
        // Group by suburb
        const bySuburb: Record<string, number> = {}
        for (const item of items) {
          const url = item.searchUrl || ''
          let suburb = 'unknown'
          if (url.includes('vaucluse')) suburb = 'vaucluse'
          else if (url.includes('rose-bay')) suburb = 'rose bay'
          else if (url.includes('bellevue-hill')) suburb = 'bellevue hill'
          bySuburb[suburb] = (bySuburb[suburb] || 0) + 1
        }
        console.log('\nBy suburb:')
        for (const [s, c] of Object.entries(bySuburb)) {
          console.log(`  ${s}: ${c}`)
        }
      } else {
        console.log('Run failed:', statusData.data?.statusMessage)
      }
      return runId
    }
  }
}

run()
