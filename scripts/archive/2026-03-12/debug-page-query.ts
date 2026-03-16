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
    .order('suburb')
    .order('current_price', { ascending: true })
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  // Group by suburb like page.tsx does
  const groupedBySuburb: Record<string, number> = {}
  ;(data || []).forEach(listing => {
    const suburb = listing.suburb || 'Unknown'
    groupedBySuburb[suburb] = (groupedBySuburb[suburb] || 0) + 1
  })
  
  // Check if potts point is in the results
  const pottsPoint = groupedBySuburb['potts point']
  console.log('Total listings:', data?.length)
  console.log('Total suburbs:', Object.keys(groupedBySuburb).length)
  console.log('Potts Point count:', pottsPoint || 0)
  
  // Show first 10 suburbs alphabetically
  const sorted = Object.keys(groupedBySuburb).sort()
  console.log('\nFirst 10 suburbs:', sorted.slice(0, 10))
  console.log('Last 10 suburbs:', sorted.slice(-10))
  
  // Check where potts point appears
  const pottsIndex = sorted.indexOf('potts point')
  if (pottsIndex >= 0) {
    console.log(`\nPotts Point is at index ${pottsIndex} of ${sorted.length}`)
  } else {
    console.log('\nPotts Point NOT FOUND in sorted list!')
  }
}

check()
