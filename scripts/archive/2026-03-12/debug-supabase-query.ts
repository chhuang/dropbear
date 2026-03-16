#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Exact same query as page.tsx
  const { data, error, count } = await supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .not('current_price', 'is', null)
    .gt('current_price', 0)
    .order('suburb')
    .order('current_price', { ascending: true })
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Total listings returned:', data?.length)
  console.log('Total count:', count)
  
  // Check if potts point is in the results
  const pottsPoint = data?.filter(l => l.suburb === 'potts point')
  console.log('Potts Point listings in result:', pottsPoint?.length || 0)
  
  // Show first 5 suburbs
  const suburbs = [...new Set(data?.map(l => l.suburb))].sort()
  console.log('\nFirst 5 suburbs:', suburbs.slice(0, 5))
  console.log('Suburbs around Potts Point:', suburbs.filter(s => s >= 'p' && s <= 'q'))
}

check()
