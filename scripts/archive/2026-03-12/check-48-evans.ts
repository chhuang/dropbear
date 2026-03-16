import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Get the listing directly
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('listing_id', 2020597470)
    .single()
  
  if (error) {
    console.log('Error:', error)
    return
  }
  
  console.log('=== 48 EVANS ST DETAILS ===\n')
  console.log('Created at:', data.created_at)
  console.log('Initial price:', data.initial_price)
  console.log('Current price:', data.current_price)
  console.log('Price text:', data.price_text)
  console.log('First seen at:', data.first_seen_at)
  console.log('Last seen at:', data.last_seen_at)
  
  // Check price history
  const { data: history } = await supabase
    .from('listings_price_history')
    .select('*')
    .eq('listing_id', data.id)
    .order('created_at', { ascending: true })
  
  console.log('\n=== PRICE HISTORY ===')
  if (history && history.length > 0) {
    for (const h of history) {
      console.log(`${h.created_at}: $${h.price?.toLocaleString()} (${h.price_text})`)
    }
  } else {
    console.log('No history records')
  }
}

check()
