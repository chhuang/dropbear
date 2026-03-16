import { createClient } from '@supabase/supabase-js'

const SUPabase = createClient(SUPabaseUrl, supabaseKey)

const now = new Date()
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

async function main() {
  // Get listings updated in last hour with both prices
  const { data: recentListings, error } = await supabase
    .from('listings')
    .select('listing_id, address, suburb, initial_price, current_price')
    .not('initial_price', 'is', null)
    .not('current_price', 'is', null)
    .gte('updated_at', oneHourAgo)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log(`\nChecking ${recentListings?.length || 0} listings updated in last hour...`)
  
  const newDrops: any[] = []
  
  for (const l of recentListings || []) {
    if (l.initial_price && l.current_price && l.current_price < l.initial_price) {
      newDrops.push({
        suburb: l.suburb,
        address: l.address,
        initial: l.initial_price,
        current: l.current_price,
        drop: l.initial_price - l.current_price,
        pct: ((l.initial_price - l.current_price) / l.initial_price * 100).toFixed(1)
      })
    }
  }
  
  if (newDrops.length > 0) {
    console.log('\n=== NEW Price Drops from Recent Sync ===\n')
    for (const d of newDrops) {
      console.log(`${d.suburb}: ${d.address}`)
      console.log(`  $${d.initial?.toLocaleString()} → $${d.current?.toLocaleString()}`)
      console.log(`  Drop: $${d.drop?.toLocaleString()} (${d.pct}%)`)
    }
  } else {
    console.log('\n✅ No new drops detected from recent sync')
  }
}

main()
