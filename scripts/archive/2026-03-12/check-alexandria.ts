import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Get all Alexandria listings
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, listing_id, address, is_active')
    .eq('suburb', 'alexandria')
    .eq('is_active', true)

  console.log(`Total active Alexandria listings: ${listings?.length || 0}`)

  // Check for coordinates - need to see if there's a lat/lng column
  const { data: sample } = await supabase
    .from('listings')
    .select('*')
    .eq('suburb', 'alexandria')
    .eq('is_active', true)
    .limit(1)

  console.log('\nSample listing columns:', Object.keys(sample?.[0] || {}))
}

check()
