#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Check with exact same filters as page.tsx
  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('current_price', 'is', null)
    .gt('current_price', 0)
    .eq('suburb', 'potts point')
  
  console.log('Potts Point (active with price):', count)
  
  // Check total
  const { count: total } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('suburb', 'potts point')
  
  console.log('Potts Point (total):', total)
}

check()
