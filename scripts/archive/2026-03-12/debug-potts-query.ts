#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Exact same query as page.tsx
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .not('current_price', 'is', null)
    .gt('current_price', 0)
    .eq('suburb', 'potts point')
    .limit(5)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Potts Point listings matching page.tsx query:', data?.length || 0)
  if (data && data.length > 0) {
    console.log('Sample:', {
      address: data[0].address,
      current_price: data[0].current_price,
      is_active: data[0].is_active,
    })
  }
}

check()
