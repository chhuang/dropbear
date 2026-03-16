import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Check apify_runs for Bronte
  const { data: runs } = await supabase
    .from('apify_runs')
    .select('*')
    .ilike('suburb', '%bronte%')
    .order('finished_at', { ascending: false })
  
  console.log('=== BRONTE APIFY RUNS ===\n')
  for (const r of runs || []) {
    console.log(`${r.finished_at} | ${r.listings_found} listings | dataset: ${r.apify_dataset_id?.slice(0, 10)}...`)
  }
  
  // Check the listing's price history
  const { data: listing } = await supabase
    .from('listings')
    .select('id, listing_id')
    .eq('suburb', 'bronte')
    .ilike('address', '%48 evans%')
    .single()
  
  if (listing) {
    console.log('\n=== PRICE HISTORY FOR 48 EVANS ST ===\n')
    const { data: history } = await supabase
      .from('listings_price_history')
      .select('*')
      .eq('listing_id', listing.id)
      .order('created_at', { ascending: true })
    
    if (history && history.length > 0) {
      for (const h of history) {
        console.log(`${h.created_at}: $${h.price?.toLocaleString()} (${h.price_text})`)
      }
    } else {
      console.log('No price history records')
    }
    
    // Also check the listing details
    const { data: details } = await supabase
      .from('listings')
      .select('created_at, first_seen_at, initial_price, current_price, price_text')
      .eq('id', listing.id)
      .single()
    
    console.log('\n=== LISTING DETAILS ===')
    console.log('Created at:', details?.created_at)
    console.log('First seen at:', details?.first_seen_at)
    console.log('Initial price:', details?.initial_price)
    console.log('Current price:', details?.current_price)
    console.log('Price text:', details?.price_text)
  }
}

check()
