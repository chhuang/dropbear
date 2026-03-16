const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const searchUrls = [
  'https://www.domain.com.au/sale/rhodes-nsw-2138/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/ryde-nsw-2112/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/carlingford-nsw-2118/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/wentworth-point-nsw-2127/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/st-leonards-nsw-2065/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/zetland-nsw-2017/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/waterloo-nsw-2017/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/wahroonga-nsw-2076/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/randwick-nsw-2031/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/rosebery-nsw-2018/?excludeunderoffer=1&ssubs=0',
]

async function run() {
  console.log('Starting batch 1 scrape for 10 suburbs...')
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
  
  for (let i = 0; i < 60; i++) {
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
          if (url.includes('rhodes')) suburb = 'rhodes'
          else if (url.includes('ryde')) suburb = 'ryde'
          else if (url.includes('carlingford')) suburb = 'carlingford'
          else if (url.includes('wentworth-point')) suburb = 'wentworth point'
          else if (url.includes('st-leonards')) suburb = 'st leonards'
          else if (url.includes('zetland')) suburb = 'zetland'
          else if (url.includes('waterloo')) suburb = 'waterloo'
          else if (url.includes('wahroonga')) suburb = 'wahroonga'
          else if (url.includes('randwick')) suburb = 'randwick'
          else if (url.includes('rosebery')) suburb = 'rosebery'
          bySuburb[suburb] = (bySuburb[suburb] || 0) + 1
        }
        console.log('\nBy suburb:')
        for (const [s, c] of Object.entries(bySuburb)) {
          console.log(`  ${s}: ${c}`)
        }
      } else {
        console.log('Run failed:', statusData.data?.statusMessage)
      }
      return { runId, datasetId: statusData.data?.defaultDatasetId }
    }
  }
}

run()
