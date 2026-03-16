import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const SUPABASE_KEY = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  SUPABASE_KEY
)

const datasetId = '8fxMtHpaqlaJ09SN3'

const suburbMap: Record<string, {name: string, postcode: string}> = {
  'rhodes': { name: 'rhodes', postcode: '2138' },
  'ryde': { name: 'ryde', postcode: '2112' },
  'carlingford': { name: 'carlingford', postcode: '2118' },
  'wentworth-point': { name: 'wentworth point', postcode: '2127' },
  'st-leonards': { name: 'st leonards', postcode: '2065' },
  'zetland': { name: 'zetland', postcode: '2017' },
  'waterloo': { name: 'waterloo', postcode: '2017' },
  'wahroonga': { name: 'wahroonga', postcode: '2076' },
  'randwick': { name: 'randwick', postcode: '2031' },
  'rosebery': { name: 'rosebery', postcode: '2018' },
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
  
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction\s*-\s*guide|For Sale\s*\|\s*|Buyers Guide\s*)/i, '')
  
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

  const stats: Record<string, {new: number, updated: number, skipped: number}> = {}
  const priceDrops: Array<{suburb: string, address: string, oldPrice: number, newPrice: number}> = []
  let missingSuburb = 0
  let missingListingId = 0
  
  for (const item of items) {
    const listingId = extractListingId(item.url)
    if (!listingId) {
      missingListingId++
      continue
    }
    
    const suburbInfo = getSuburbFromUrl(item.searchUrl || item.url)
    if (!suburbInfo) {
      missingSuburb++
      continue
    }
    
    if (!stats[suburbInfo.name]) stats[suburbInfo.name] = { new: 0, updated: 0, skipped: 0 }
    
    const price = parsePrice(item.price)
    const address = item.address ? `${item.address.street || ''}, ${item.address.suburb || ''}`.trim() : null
    
    const { data: existing, error: selectError } = await supabase
      .from('listings')
      .select('id, current_price')
      .eq('listing_id', listingId)
      .single()
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.log(`Select error for ${listingId}:`, selectError.message)
      stats[suburbInfo.name].skipped++
      continue
    }
    
    if (existing) {
      // Check for price drop
      if (existing.current_price && price && price < existing.current_price) {
        priceDrops.push({
          suburb: suburbInfo.name,
          address: address || item.title || `ID ${listingId}`,
          oldPrice: existing.current_price,
          newPrice: price
        })
      }
      
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          current_price: price,
          price_text: item.price,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('listing_id', listingId)
      
      if (updateError) {
        console.log(`Update error for ${listingId}:`, updateError.message)
        stats[suburbInfo.name].skipped++
      } else {
        stats[suburbInfo.name].updated++
      }
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
          address: address,
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
        console.log(`Insert error for ${listingId}:`, error.message)
        stats[suburbInfo.name].skipped++
      } else {
        stats[suburbInfo.name].new++
      }
    }
  }
  
  console.log('\n=== Batch 1 Sync Results ===')
  console.log(`Missing suburb: ${missingSuburb}`)
  console.log(`Missing listing ID: ${missingListingId}`)
  
  for (const [suburb, s] of Object.entries(stats)) {
    console.log(`${suburb}: ${s.new} new, ${s.updated} updated, ${s.skipped} skipped`)
  }
  
  if (priceDrops.length > 0) {
    console.log('\n=== Price Drops Detected ===')
    for (const drop of priceDrops) {
      const diff = drop.oldPrice - drop.newPrice
      const pct = ((diff / drop.oldPrice) * 100).toFixed(1)
      console.log(`${drop.suburb}: ${drop.address}`)
      console.log(`  $${drop.oldPrice.toLocaleString()} → $${drop.newPrice.toLocaleString()} (-${pct}%)`)
    }
  }
  
  // Check final state
  console.log('\n=== Database State ===')
  for (const suburb of Object.keys(suburbMap).map(k => suburbMap[k].name)) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, current_price')
      .eq('suburb', suburb)
      .eq('is_active', true)
    
    if (error) {
      console.log(`${suburb}: error - ${error.message}`)
    } else {
      const withPrice = data?.filter(l => l.current_price && l.current_price > 0) || []
      console.log(`${suburb}: ${data?.length || 0} active, ${withPrice.length} with price`)
    }
  }
}

sync()
