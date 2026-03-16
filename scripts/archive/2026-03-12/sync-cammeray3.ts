import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

const runId = 'JspNwDmBoyxvcyiGP'

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
  
  // Strip common prefixes
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction\s*-\s*guide|For Sale\s*\|\s*)/i, '')
  
  // Try price ranges with units
  const rangeWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?/i)
  if (rangeWithUnitMatch) {
    let num = parseFloat(rangeWithUnitMatch[1].replace(/,/g, ''))
    const unit = rangeWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  // Try single price with unit ($1.5M, $500K)
  const singleWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)\b/i)
  if (singleWithUnitMatch) {
    let num = parseFloat(singleWithUnitMatch[1].replace(/,/g, ''))
    const unit = singleWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  // Try plain number with $ sign
  const plainMatch = text.match(/\$([\d,]+(?:\.\d+)?)/)
  if (plainMatch) {
    let num = parseFloat(plainMatch[1].replace(/,/g, ''))
    if (num >= 10000) return Math.round(num)
  }
  
  return undefined
}

async function sync() {
  // Get dataset
  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&clean=true`
  )
  const items = await itemsRes.json()
  console.log('Items:', items.length)

  let newCount = 0
  
  for (const item of items) {
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const price = parsePrice(item.price)
    
    // Check if exists
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('listing_id', listingId)
      .single()
    
    if (existing) {
      // Update
      await supabase
        .from('listings')
        .update({
          current_price: price,
          price_text: item.price,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('listing_id', listingId)
    } else {
      // Insert with state
      const { error } = await supabase
        .from('listings')
        .insert({
          listing_id: listingId,
          url: item.url,
          source: 'domain.com.au',
          suburb: 'cammeray',
          state: 'nsw',
          postcode: '2062',
          address: item.address ? `${item.address.street || ''}, ${item.address.suburb || 'Cammeray'}`.trim() : null,
          title: item.title,
          property_type: item.features?.propertyTypeFormatted || item.propertyType,
          bedrooms: item.features?.beds || item.bedrooms,
          bathrooms: item.features?.baths || item.bathrooms,
          car_spaces: item.features?.parking || item.carspaces || item.parking,
          price_text: item.price,
          current_price: price,
          initial_price: price,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        })
      
      if (error) {
        console.log('Insert error:', error.message)
      } else {
        newCount++
      }
    }
  }
  
  console.log(`Done: ${newCount} new`)
  
  // Check how many have prices
  const { data: cammeray } = await supabase
    .from('listings')
    .select('id, current_price')
    .eq('suburb', 'cammeray')
    .eq('is_active', true)
  
  const withPrice = cammeray?.filter(l => l.current_price && l.current_price > 0) || []
  console.log(`\nCammeray active: ${cammeray?.length || 0}, with price: ${withPrice.length}`)
}

sync()
