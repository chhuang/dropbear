import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Get the listing with UUID
  const { data: listing } = await supabase
    .from('listings')
    .select('id, listing_id, address, initial_price, current_price')
    .eq('listing_id', 2020597470)
    .single()
  
  console.log('Listing:', listing)
  
  if (listing) {
    // Check price history using the UUID id
    const { data: history, count } = await supabase
      .from('listings_price_history')
      .select('*', { count: 'exact' })
      .eq('listing_id', listing.id)
    
    console.log('\nPrice history count:', count)
    console.log('History:', history)
  }
}

check()
