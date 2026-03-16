const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const searchUrl = 'https://www.domain.com.au/sale/cammeray-nsw-2062/?excludeunderoffer=1&ssubs=0'

async function run() {
  console.log('Starting Cammeray scrape...')
  console.log('URL:', searchUrl)
  
  // Start the actor
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrls: [searchUrl],
        proxyConfiguration: { useApifyProxy: true }
      })
    }
  )
  
  const runData = await startRes.json()
  const runId = runData.data?.id
  console.log('Run ID:', runId)
  
  // Poll until done
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000))
    
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    const statusData = await statusRes.json()
    const status = statusData.data?.status
    
    console.log(`[${(i+1)*5}s] ${status}`)
    
    if (status === 'SUCCEEDED' || status === 'FAILED') {
      if (status === 'SUCCEEDED') {
        // Get dataset items
        const datasetId = statusData.data?.defaultDatasetId
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
        )
        const items = await itemsRes.json()
        console.log('\nResults:', items.length, 'items')
        
        if (items.length > 0) {
          console.log('\nSample item:', JSON.stringify(items[0], null, 2).slice(0, 500))
        }
      } else {
        console.log('Run failed:', statusData.data?.statusMessage)
      }
      break
    }
  }
}

run()
