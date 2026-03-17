import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  const { data: listings, error } = await supabase
    .from('listings')
    .select('listing_id, address, suburb, initial_price, current_price')
    .not('initial_price', 'is', null)
    .not('current_price', 'is', null)
    .limit(1000)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  if (!listings || listings.length === 0) {
    console.log('No listings with price data')
    return
  }
  
  console.log(`Found ${listings.length} listings with prices\n`)
  
  const drops = []
  
  for (const l of listings) {
    const initial = l.initial_price
    const current = l.current_price
    
    if (initial && current && initial > current) {
      drops.push({
        suburb: l.suburb,
        address: l.address,
        initial: initial,
        current: current,
        drop: initial - current,
        pct: ((initial - current) / initial * 100).toFixed(1)
      })
    }
  }
  
  if (drops.length === 0) {
    console.log('No price drops found')
    return
  }
  
  drops.sort((a, b) => b.drop - a.drop)
  
  console.log('\n=== PRICE DROPS ===\n')
  console.log('Suburb'.padEnd(20) + 'Address'.padEnd(40) + 'Initial'.padStart(12) + 'Current'.padStart(10) + 'Drop ($)'.padStart(10) + 'Drop %')
  console.log('-'.repeat(70))
  
  for (const d of drops) {
    console.log(
      d.suburb.padEnd(20) +
      d.address.padEnd(38) +
      `$${d.initial.toLocaleString()}`.padStart(12) +
      `$${d.current.toLocaleString()}`.padStart(10) +
      `-${d.drop}`.padStart(8) +
      `${d.pct}%`
    )
  }
  
  console.log(`\nTotal: ${drops.length} drops`)
}

main()
