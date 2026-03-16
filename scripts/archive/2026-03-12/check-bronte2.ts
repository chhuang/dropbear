import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('suburb', 'bronte')
    .ilike('address', '%evans%')
  
  if (error) {
    console.log('Error:', error)
    return
  }
  
  for (const l of data || []) {
    console.log('===', l.address, '===\n')
    console.log('URL:', l.url)
    console.log('Initial Price:', l.initial_price ? `$${(l.initial_price/1000000).toFixed(2)}M` : 'N/A')
    console.log('Current Price:', l.current_price ? `$${(l.current_price/1000000).toFixed(2)}M` : 'N/A')
    console.log('Price Text:', l.price_text)
    console.log('Bedrooms:', l.bedrooms)
    console.log('Bathrooms:', l.bathrooms)
    console.log('Car Spaces:', l.car_spaces)
    console.log('Property Type:', l.property_type)
    console.log('First Seen:', l.first_seen_at)
    console.log('Last Seen:', l.last_seen_at)
    
    // Get price history
    const { data: history } = await supabase
      .from('listings_price_history')
      .select('*')
      .eq('listing_id', l.id)
      .order('created_at', { ascending: true })
    
    if (history && history.length > 0) {
      console.log('\nPrice History:')
      for (const h of history) {
        console.log(`  ${h.created_at}: $${(h.price/1000000).toFixed(2)}M (${h.price_text || 'no text'})`)
      }
    }
    console.log('\n---\n')
  }
}

check()
