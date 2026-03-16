import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const datasetId = 'zt25CboPcWRCaewaI'

function extractListingId(url: string): number | undefined {
  if (!url) return undefined
  const match = url.match(/-(\d+)$/)
  return match ? parseInt(match[1]) : undefined
}

function parsePrice(text: any): number | undefined {
  if (!text) return undefined
  if (typeof text === 'number') return text >= 10000 ? text : undefined
  if (typeof text !== 'string') return undefined
  
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return undefined
  
  const unitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?/i)
  if (unitMatch) {
    let num = parseFloat(unitMatch[1].replace(/,/g, ''))
    const unit = unitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  return undefined
}

async function main() {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`)
  const items = await res.json()
  console.log(`Fetched ${items.length} items`)
  
  let newCount = 0, updateCount = 0
  
  for (const item of items) {
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const suburbMatch = item.url?.match(/sale\/([^\/]+)-nsw-(\d+)/)
    if (!suburbMatch) continue
    
    const suburb = suburbMatch[1].replace(/-/g, ' ')
    const postcode = suburbMatch[2]
    const price = parsePrice(item.price)
    
    const { data: existing } = await supabase
      .from('listings')
      .select('id, current_price')
      .eq('listing_id', listingId)
      .maybeSingle()
    
    if (existing) {
      if (price && existing.current_price !== price) {
        await supabase.from('listings').update({ current_price: price, price_text: item.price }).eq('id', existing.id)
        updateCount++
      }
    } else {
      await supabase.from('listings').insert({
        listing_id: listingId,
        url: item.url,
        source: 'domain.com.au',
        suburb,
        state: 'nsw',
        postcode,
        address: item.address,
        price_text: item.price,
        current_price: price,
        initial_price: price,
        is_active: true,
      })
      newCount++
    }
  }
  
  console.log(`New: ${newCount}, Updated: ${updateCount}`)
}

main().catch(console.error)
