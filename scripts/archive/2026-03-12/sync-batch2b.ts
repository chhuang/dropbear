import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

const datasetId = 'xWvZ9jO5KnS9rXh8g'

const suburbMap: Record<string, {name: string, postcode: string}> = {
  'north-sydney': { name: 'north sydney', postcode: '2060' },
  'manly': { name: 'manly', postcode: '2095' },
  'wolli-creek': { name: 'wolli creek', postcode: '2205' },
  'gordon': { name: 'gordon', postcode: '2072' },
  'willoughby': { name: 'willoughby', postcode: '2068' },
  'killara': { name: 'killara', postcode: '2071' },
  'surry-hills': { name: 'surry hills', postcode: '2010' },
}

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
  
  const plainMatch = text.match(/\$([\d,]+(?:\.\d+)?)/)
  if (plainMatch) {
    let num = parseFloat(plainMatch[1].replace(/,/g, ''))
    if (num >= 10000) return Math.round(num)
  }
  
  return undefined
}

function getSuburbFromUrl(url: string): {name: string, postcode: string} | null {
  for (const [key, value] of Object.entries(suburbMap)) {
    if (url.includes(key)) return value
  }
  return null
}

async function sync() {
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
  )
  const items = await itemsRes.json()
  console.log('Total items:', items.length)

  const stats: Record<string, {new: number, updated: number, withPrice: number, noPrice: number}> = {}
  const drops: Array<{suburb: string, address: string, oldPrice: number, newPrice: number}> = []
  
  for (const item of items) {
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const suburbInfo = getSuburbFromUrl(item.searchUrl || item.url)
    if (!suburbInfo) continue
    
    if (!stats[suburbInfo.name]) stats[suburbInfo.name] = { new: 0, updated: 0, withPrice: 0, noPrice: 0 }
    
    const price = parsePrice(item.price)
    
    if (price) stats[suburbInfo.name].withPrice++
    else stats[suburbInfo.name].noPrice++
    
    const { data: existing } = await supabase
      .from('listings')
      .select('id, current_price, initial_price')
      .eq('listing_id', listingId)
      .single()
    
    if (existing) {
      const oldPrice = existing.current_price || existing.initial_price
      if (oldPrice && price && price < oldPrice) {
        drops.push({
          suburb: suburbInfo.name,
          address: item.address ? `${item.address.street || ''}, ${item.address.suburb || ''}`.trim() : item.title,
          oldPrice,
          newPrice: price
        })
      }
      
      await supabase
        .from('listings')
        .update({
          current_price: price,
          price_text: item.price,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('listing_id', listingId)
      stats[suburbInfo.name].updated++
    } else {
      const { error } = await supabase
        .from('listings')
        .insert({
          listing_id: listingId,
          url: item.url,
          source: 'domain.com.au',
          suburb: suburbInfo.name,
          state: 'nsw',
          postcode: suburbInfo.postcode,
          address: item.address ? `${item.address.street || ''}, ${item.address.suburb || ''}`.trim() : null,
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
      
      if (!error) stats[suburbInfo.name].new++
    }
  }
  
  console.log('\n=== Batch 2b Sync Results ===')
  for (const [suburb, s] of Object.entries(stats)) {
    const pricePct = s.withPrice + s.noPrice > 0 
      ? Math.round(s.withPrice / (s.withPrice + s.noPrice) * 100) 
      : 0
    console.log(`${suburb}: ${s.new} new, ${s.updated} updated (${pricePct}% with price)`)
  }
  
  if (drops.length > 0) {
    console.log('\n=== Price Drops Detected ===')
    for (const d of drops) {
      const pct = ((d.oldPrice - d.newPrice) / d.oldPrice * 100).toFixed(1)
      console.log(`${d.suburb}: ${d.address}\n  $${d.oldPrice.toLocaleString()} → $${d.newPrice.toLocaleString()} (-${pct}%)`)
    }
  }
}

sync()
