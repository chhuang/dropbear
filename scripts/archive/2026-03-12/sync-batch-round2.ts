import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DATASET_ID = 'oXAmCggyD3yyGWeXC'

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

async function main() {
  console.log('Fetching dataset', DATASET_ID)
  
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}&limit=50000`,
    { headers: { 'Accept': 'application/json' } }
  )
  const items = await response.json()
  console.log(`Fetched ${items.length} items`)
  
  const stats = { found: 0, new: 0, updated: 0, skipped: 0, noPrice: 0, drops: 0 }
  const bySuburb: Record<string, number> = {}
  
  for (const item of items) {
    if (!item.url) continue
    stats.found++
    
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const suburbRaw = item.address?.suburb || item.suburb
    if (!suburbRaw) continue
    
    const suburb = suburbRaw.toLowerCase().replace(/ /g, '-')
    const postcode = item.address?.postcode || ''
    const suburbDisplay = suburbRaw.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    
    bySuburb[suburb] = (bySuburb[suburb] || 0) + 1
    
    const price = parsePrice(item.price)
    
    if (!price) {
      stats.noPrice++
      continue
    }
    
    const { data: existing } = await supabase
      .from('listings')
      .select('id, current_price, initial_price')
      .eq('listing_id', listingId)
      .maybeSingle()
    
    if (existing) {
      const updates: any = { last_seen_at: new Date().toISOString() }
      
      if (price && existing.current_price !== price) {
        // Check for drop
        if (existing.initial_price && price < existing.initial_price) {
          stats.drops++
        }
        updates.current_price = price
        updates.price_text = item.price
        
        await supabase.from('listings_price_history').insert({
          listing_id: existing.id,
          price,
          price_text: item.price
        })
      }
      
      await supabase.from('listings').update(updates).eq('id', existing.id)
      stats.updated++
    } else {
      const { error } = await supabase.from('listings').insert({
        listing_id: listingId,
        url: item.url,
        source: 'domain.com.au',
        suburb: suburbDisplay,
        state: 'NSW',
        postcode,
        address: item.address?.fullAddress || item.address?.street,
        title: item.title,
        property_type: item.features?.propertyTypeFormatted?.split(' / ')[0],
        bedrooms: item.features?.beds,
        bathrooms: item.features?.baths,
        car_spaces: item.features?.parking,
        building_size: item.features?.buildingSize,
        land_size: item.features?.landSize,
        price_text: item.price,
        current_price: price,
        initial_price: price,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        is_active: true,
        agent_name: item.agent?.name,
        agent_phone: item.agent?.phone,
        images: item.images?.map((i: any) => i.url)
      })
      
      if (error) {
        console.error('Insert error:', error.message)
      } else {
        stats.new++
      }
    }
  }
  
  console.log('\n=== Sync Results ===')
  console.log('Found:', stats.found)
  console.log('New:', stats.new)
  console.log('Updated:', stats.updated)
  console.log('Drops detected:', stats.drops)
  console.log('No price:', stats.noPrice)
  console.log('\nBy suburb:')
  for (const [s, count] of Object.entries(bySuburb).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${count}`)
  }
}

main().catch(console.error)
