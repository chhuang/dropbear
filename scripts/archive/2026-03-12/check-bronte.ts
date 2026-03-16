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
    .single()
  
  if (error) {
    console.log('Error:', error)
    return
  }
  
  console.log('=== BRONTE DROP DETAILS ===\n')
  console.log('URL:', data.url)
  console.log('Address:', data.address)
  console.log('Initial Price: $' + (data.initial_price / 1000000).toFixed(1) + 'M')
  console.log('Current Price: $' + (data.current_price / 1000000).toFixed(1) + 'M')
  console.log('Drop: $' + ((data.initial_price - data.current_price) / 1000) + 'K')
  console.log('Drop %:', ((data.initial_price - data.current_price) / data.initial_price * 100).toFixed(1) + '%')
  console.log('\nProperty Type:', data.property_type)
  console.log('Bedrooms:', data.bedrooms)
  console.log('Bathrooms:', data.bathrooms)
  console.log('Car Spaces:', data.car_spaces)
  console.log('Title:', data.title)
  console.log('\nFirst Seen:', data.created_at)
  console.log('Last Seen:', data.last_seen_at)
  
  // Check price history
  const { data: history } = await supabase
    .from('listings_price_history')
    .select('*')
    .eq('listing_id', data.id)
    .order('created_at', { ascending: true })
  
  if (history && history.length > 0) {
    console.log('\n=== PRICE HISTORY ===')
    for (const h of history) {
      console.log(`${h.created_at}: $${(h.price/1000000).toFixed(1)}M (${h.price_text})`)
    }
  }
}

check()
