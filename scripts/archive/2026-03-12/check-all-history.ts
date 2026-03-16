import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  const { data, count } = await supabase
    .from('listings_price_history')
    .select('*', { count: 'exact' })
    .limit(10)
  
  console.log('Total price history records:', count)
  
  if (data && data.length > 0) {
    console.log('\nSample records:')
    for (const h of data) {
      console.log(`  listing_id: ${h.listing_id}, price: $${h.price}, created: ${h.created_at}`)
    }
  }
}

check()
