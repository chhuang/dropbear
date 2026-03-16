import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, suburb, current_price, is_active')
    .eq('suburb', 'alexandria')
    .eq('is_active', true)
    .not('current_price', 'is', null)
    .gt('current_price', 0)
    .limit(5)

  console.log('Alexandria active with price:', data?.length, 'listings')
  if (error) console.log('Error:', error)
  console.log('Sample:', data?.[0])
}

check()
