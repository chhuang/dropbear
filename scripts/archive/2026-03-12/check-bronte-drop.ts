import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Find the Bronte listing with a price drop
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('suburb', 'bronte')
    .not('initial_price', 'is', null)
    .not('current_price', 'is', null)
  
  if (error) {
    console.log('Error:', error)
    return
  }
  
  console.log('=== All Bronte Listings with Price Data ===\n')
  
  for (const l of data || []) {
    const drop = l.initial_price && l.current_price && l.current_price < l.initial_price
    const dropAmt = drop ? l.initial_price - l.current_price : 0
    const dropPct = drop ? ((dropAmt / l.initial_price) * 100).toFixed(1) : '0'
    
    console.log(`${l.address}`)
    console.log(`  URL: ${l.url}`)
    console.log(`  Initial: $${l.initial_price?.toLocaleString()} | Current: $${l.current_price?.toLocaleString()}`)
    if (drop) {
      console.log(`  ⚠️ DROP: -$${dropAmt.toLocaleString()} (-${dropPct}%)`)
    }
    console.log(`  Beds: ${l.bedrooms} | Baths: ${l.bathrooms} | Cars: ${l.car_spaces}`)
    console.log(`  Type: ${l.property_type}`)
    console.log(`  Price Text: ${l.price_text}`)
    console.log(`  First Seen: ${l.first_seen_at}`)
    console.log(`  Last Seen: ${l.last_seen_at}`)
    console.log()
    
    // Get price history
    if (l.id) {
      const { data: history } = await supabase
        .from('listings_price_history')
        .select('*')
        .eq('listing_id', l.id)
        .order('created_at', { ascending: true })
      
      if (history && history.length > 1) {
        console.log(`  Price History:`)
        for (const h of history) {
          console.log(`    ${h.created_at}: $${h.price?.toLocaleString()} (${h.price_text})`)
        }
        console.log()
      }
    }
  }
}

check()
