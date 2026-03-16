import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
)

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const DATASET_ID = 'd5311Ez8ZyG5xo0SH'

function parsePrice(priceText: string | null): number | null {
  if (!priceText) return null
  const cleaned = priceText.replace(/[$,]/g, '').replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = parseFloat(match[1])
  if (value < 10000) return null
  const multipliers: Record<string, number> = { m: 1000000, mil: 1000000, million: 1000000, k: 1000 }
  for (const [suffix, mult] of Object.entries(multipliers)) {
    if (cleaned.toLowerCase().includes(suffix)) return Math.round(value * mult)
  }
  return Math.round(value)
}

async function sync() {
  const res = await fetch(`https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}`)
  const items = await res.json() as any[]
  console.log(`Fetched ${items.length} items`)

  let newCount = 0
  let updateCount = 0

  for (const item of items) {
    const listingId = item.url?.split('-').pop()?.replace(/\D/g, '') || item.id?.toString()
    if (!listingId) continue

    const suburb = (item.address?.suburb || 'North Bondi').toLowerCase()
    const price = parsePrice(item.price)

    const listing = {
      listing_id: parseInt(listingId),
      url: item.url,
      source: 'domain.com.au',
      suburb,
      state: (item.address?.state || 'NSW').toLowerCase(),
      postcode: item.address?.postcode || '2026',
      address: JSON.stringify(item.address),
      title: item.title,
      property_type: item.features?.propertyTypeFormatted?.split('/')[0].trim() || item.features?.propertyType,
      bedrooms: item.features?.beds,
      bathrooms: item.features?.baths,
      car_spaces: item.features?.parking,
      building_size: item.features?.buildingSize,
      land_size: item.features?.landSize,
      price_text: item.price,
      current_price: price,
      initial_price: price,
      inspection_times: item.inspectionTimes,
      images: item.images,
      is_active: true,
      agent_name: item.agent?.name,
      agent_phone: item.agent?.phone,
    }

    const { data: existing } = await supabase
      .from('listings')
      .select('id, current_price, initial_price')
      .eq('listing_id', listing.listing_id)
      .single()

    if (existing) {
      const updates: any = { last_seen_at: new Date().toISOString(), is_active: true }
      if (price !== existing.current_price) {
        updates.current_price = price
        updates.price_text = item.price
      }
      await supabase.from('listings').update(updates).eq('id', existing.id)
      updateCount++
    } else {
      await supabase.from('listings').insert(listing)
      newCount++
    }
  }

  console.log(`New: ${newCount}, Updated: ${updateCount}`)
}

sync()
