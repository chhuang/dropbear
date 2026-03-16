const APIFY_TOKEN = process.env.APIFY_TOKEN!
const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'

const datasetId = process.argv[2]

function parsePrice(text: any): number | null {
  if (!text || typeof text !== 'string') return null
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return null
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About)/i, '')
  
  const withUnit = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mk]|million|thousand)\b/i)
  if (withUnit) {
    let num = parseFloat(withUnit[1].replace(/,/g, ''))
    if (withUnit[2]?.toLowerCase() === 'm' || withUnit[2]?.toLowerCase() === 'million') num *= 1000000
    if (withUnit[2]?.toLowerCase() === 'k' || withUnit[2]?.toLowerCase() === 'thousand') num *= 1000
    return num >= 10000 ? Math.round(num) : null
  }
  
  const numeric = text.match(/\$([\d,]+(?:\.\d+)?)/)
  if (numeric) {
    const num = parseFloat(numeric[1].replace(/,/g, ''))
    return num >= 10000 ? Math.round(num) : null
  }
  return null
}

function extractPostcode(url: string): string | null {
  const match = url.match(/-(\d{4})-(\d+)$/)
  return match ? match[1] : null
}

async function sync() {
  console.log(`Fetching dataset ${datasetId}...`)
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=1`)
  const items = await response.json()
  console.log(`Found ${items.length} items`)

  let synced = 0, withPrice = 0
  for (const item of items) {
    if (!item.url) continue
    
    const listingId = parseInt(item.url.match(/-(\d+)$/)?.[1] || '0')
    if (!listingId) continue

    const price = parsePrice(item.price)
    if (price) withPrice++
    
    const postcode = extractPostcode(item.url)
    
    // Check if exists
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?listing_id=eq.${listingId}&select=id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    })
    const existing = await checkRes.json()
    
    const listing = {
      listing_id: listingId,
      suburb: (item.address?.suburb || '').toLowerCase(),
      postcode: postcode,
      address: item.address?.line || '',
      price_text: item.price || null,
      current_price: price,
      initial_price: price,
      bedrooms: item.features?.beds || null,
      bathrooms: item.features?.baths || null,
      car_spaces: item.features?.parking || null,
      property_type: item.features?.propertyTypeFormatted?.split('/')[0]?.trim() || null,
      url: item.url,
      is_active: true,
      state: 'nsw'
    }

    if (existing.length > 0) {
      // Update (don't overwrite initial_price)
      const { initial_price, ...updateData } = listing
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { 
          'apikey': SUPABASE_KEY, 
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(updateData)
      })
      if (res.ok) synced++
    } else {
      // Insert
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: { 
          'apikey': SUPABASE_KEY, 
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(listing)
      })
      if (res.ok) synced++
      else console.log(`Insert error: ${await res.text()}`)
    }
  }
  console.log(`Synced ${synced} listings (${withPrice} with price)`)
}

sync().catch(console.error)
