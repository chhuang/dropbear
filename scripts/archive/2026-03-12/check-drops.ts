import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Check for listings where current_price < initial_price
  const { data: drops, error } = await supabase
    .from('listings')
    .select('listing_id, url, suburb, current_price, initial_price, address')
    .lt('current_price', 900000000) // not null
    .not('current_price', 'is', null)
    .not('initial_price', 'is', null)
  
  if (error) {
    console.log('Error:', error)
    return
  }
  
  const actualDrops = (drops || []).filter(l => 
    l.current_price && l.initial_price && l.current_price < l.initial_price
  )
  
  actualDrops.sort((a, b) => {
    const dropA = a.initial_price! - a.current_price!
    const dropB = b.initial_price! - b.current_price!
    return dropB - dropA
  })
  
  console.log(`=== PRICE DROPS (${actualDrops.length} total) ===\n`)
  
  for (const l of actualDrops.slice(0, 20)) {
    const drop = l.initial_price! - l.current_price!
    const pct = ((drop / l.initial_price!) * 100).toFixed(1)
    console.log(`${l.suburb?.padEnd(15)} | ${l.address?.slice(0, 40).padEnd(42)} | $${(l.initial_price!/1000).toFixed(0)}K → $${(l.current_price!/1000).toFixed(0)}K | -$${(drop/1000).toFixed(0)}K (${pct}%)`)
  }
  
  if (actualDrops.length > 20) {
    console.log(`\n... and ${actualDrops.length - 20} more`)
  }
  
  // By suburb summary
  const bySuburb: Record<string, number> = {}
  for (const l of actualDrops) {
    bySuburb[l.suburb || 'unknown'] = (bySuburb[l.suburb || 'unknown'] || 0) + 1
  }
  
  console.log('\n=== BY SUBURB ===\n')
  const sorted = Object.entries(bySuburb).sort((a, b) => b[1] - a[1])
  for (const [suburb, count] of sorted) {
    console.log(`${suburb.padEnd(15)} ${count} drops`)
  }
}

check()
