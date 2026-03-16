import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function syncRun(apifyRunId: string, suburb: string) {
  console.log(`\n🔄 Syncing ${suburb} (run: ${apifyRunId})...`)
  
  // Get dataset ID from Apify
  const runRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${apifyRunId}?token=${APIFY_TOKEN}`
  )
  const runData = await runRes.json()
  const datasetId = runData.data.defaultDatasetId
  
  if (!datasetId) {
    console.error('No dataset ID found')
    return
  }
  
  console.log(`📊 Dataset: ${datasetId}`)
  
  // Fetch dataset items
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
  )
  const items = await itemsRes.json()
  
  console.log(`📋 Found ${items.length} items`)
  
  // Get existing listings to check for duplicates
  const { data: existingListings } = await supabase
    .from('listings')
    .select('listing_id')
    .eq('suburb', suburb)
  
  const existingIds = new Set(existingListings?.map(l => l.listing_id) || [])
  
  let newCount = 0
  let updateCount = 0
  
  for (const item of items) {
    if (!item.url) continue
    
    const listingId = parseInt(item.url.match(/-(\d+)$/)?.[1] || '0')
    if (!listingId) continue
    
    const listing = {
      listing_id: listingId,
      suburb: suburb,
      address: item.address?.value || item.address || '',
      current_price: parsePrice(item.price),
      price_text: item.price,
      bedrooms: item.features?.beds,
      bathrooms: item.features?.baths,
      car_spaces: item.features?.parking,
      property_type: item.features?.propertyTypeFormatted?.split('/')[0]?.trim(),
      url: item.url,
      is_active: true
    }
    
    if (existingIds.has(listingId)) {
      // Update existing
      await supabase
        .from('listings')
        .update({ 
          current_price: listing.current_price,
          price_text: listing.price_text,
          is_active: true
        })
        .eq('listing_id', listingId)
      updateCount++
    } else {
      // Insert new
      await supabase.from('listings').insert(listing)
      newCount++
    }
  }
  
  console.log(`✅ Synced ${suburb}: ${newCount} new, ${updateCount} updated`)
}

function parsePrice(text: any): number | null {
  if (!text) return null
  if (typeof text === 'number') {
    return text < 10000 ? null : text
  }
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return null
  
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction)/i, '')
  
  const rangeMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)/)
  if (rangeMatch) {
    let num = parseFloat(rangeMatch[1].replace(/,/g, ''))
    const unit = rangeMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    return num >= 10000 ? Math.round(num) : null
  }
  
  const unitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)/i)
  if (unitMatch) {
    let num = parseFloat(unitMatch[1].replace(/,/g, ''))
    const unit = unitMatch[2].toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    return num >= 10000 ? Math.round(num) : null
  }
  
  const plainMatch = text.match(/\$([\d,]+)/)
  if (plainMatch) {
    const num = parseFloat(plainMatch[1].replace(/,/g, ''))
    return num >= 10000 ? num : null
  }
  
  return null
}

// Sync the 5 runs
const runs = [
  { id: 'oUx4nihC0PQMdv3qO', suburb: 'chatswood' },
  { id: 'C5u6A96a8w0I2KAPS', suburb: 'ryde' },
  { id: 'Y0aZSKqomb6qUceWW', suburb: 'hurstville' },
  { id: 'bJqY6hNnppD6Ljv89', suburb: 'burwood' },
  { id: 'ACvKch3V4UaE3Vhcd', suburb: 'epping' }
]

for (const run of runs) {
  await syncRun(run.id, run.suburb)
}

console.log('\n✅ All done!')
