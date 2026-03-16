import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const datasets = [
  { id: 'cjfJFT6Ab992cbo25', name: 'Batch 1 full' },
  { id: 'xWvZ9jO5KnS9rXh8g', name: 'Batch 2 limited' },
  { id: 'BCJJ5iuQmVv6gOs6S', name: 'Rhodes + Wentworth Point' },
]

function extractListingId(url: string): number {
  const match = url.match(/-(\d+)$/)
  return match ? parseInt(match[1]) : 0
}

function parsePrice(text: any): number | undefined {
  if (!text) return undefined
  if (typeof text === 'number') {
    if (text < 10000) return undefined
    return text
  }
  
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return undefined
  
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction\s*-\s*guide|For Sale\s*\|\s*)/i, '')
  
  const rangeWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?/i)
  if (rangeWithUnitMatch) {
    let num = parseFloat(rangeWithUnitMatch[1].replace(/,/g, ''))
    const unit = rangeWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  const singleWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)\b/i)
  if (singleWithUnitMatch) {
    let num = parseFloat(singleWithUnitMatch[1].replace(/,/g, ''))
    const unit = singleWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  const numericMatch = text.match(/\$([\d,]+(?:\.\d+)?)/)
  if (numericMatch) {
    const num = parseFloat(numericMatch[1].replace(/,/g, ''))
    if (num >= 10000) return Math.round(num)
  }
  
  return undefined
}

async function syncDataset(datasetId: string, label: string) {
  console.log(`\n=== Syncing ${label} (${datasetId}) ===`)
  
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=50000`,
    { headers: { 'Accept': 'application/json' } }
  )
  const items = await response.json()
  console.log(`Fetched ${items.length} items`)
  
  const stats = { found: 0, new: 0, updated: 0, skipped: 0 }
  
  for (const item of items) {
    if (!item.url) continue
    stats.found++
    
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const suburbMatch = item.url?.match(/sale\/([^\/]+)-nsw-(\d+)/)
    if (!suburbMatch) continue
    
    const suburb = suburbMatch[1].toLowerCase()
    const postcode = suburbMatch[2]
    const price = parsePrice(item.price)
    
    const { data: existing } = await supabase
      .from('listings')
      .select('id, price')
      .eq('listing_id', listingId)
      .maybeSingle()
    
    if (existing) {
      if (price && existing.price !== price) {
        await supabase
          .from('listings')
          .update({ price, price_text: item.price })
          .eq('id', existing.id)
        stats.updated++
      } else {
        stats.skipped++
      }
    } else {
      await supabase
        .from('listings')
        .insert({
          listing_id: listingId,
          url: item.url,
          address: item.address,
          suburb,
          state: 'nsw',
          postcode,
          price,
          price_text: item.price,
          is_active: true,
        })
      stats.new++
    }
  }
  
  console.log(`  Found: ${stats.found}`)
  console.log(`  New: ${stats.new}`)
  console.log(`  Updated: ${stats.updated}`)
  console.log(`  Skipped: ${stats.skipped}`)
}

async function main() {
  for (const ds of datasets) {
    await syncDataset(ds.id, ds.name)
  }
  console.log('\n=== All done! ===')
}

main().catch(console.error)
