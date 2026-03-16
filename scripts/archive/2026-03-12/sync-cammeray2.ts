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
  const str = String(text)
  const match = str.match(/\$?([\d,]+)/)
  if (match) return parseInt(match[1].replace(/,/g, ''))
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
      // Insert
      const { error } = await supabase
        .from('listings')
        .insert({
          listing_id: listingId,
          url: item.url,
          suburb: 'cammeray',
          address: item.address,
          current_price: price,
          price_text: item.price,
          bedrooms: item.bedrooms,
          bathrooms: item.bathrooms,
          car_spaces: item.carspaces || item.parking,
          property_type: item.propertyType,
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
