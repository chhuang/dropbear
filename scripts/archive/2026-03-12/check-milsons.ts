import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Check all variations
  const { data: all } = await supabase
    .from('listings')
    .select('id, suburb, current_price, is_active')
    .ilike('suburb', '%milson%')

  console.log('All Milsons variations:', all?.length || 0)
  
  const grouped: Record<string, number> = {}
  for (const l of all || []) {
    grouped[l.suburb] = (grouped[l.suburb] || 0) + 1
  }
  console.log('\nGrouped:')
  for (const [suburb, count] of Object.entries(grouped)) {
    console.log(`  "${suburb}": ${count}`)
  }

  // Check SUBURB_COORDS in the frontend
  console.log('\nChecking if "milsons point" is in SUBURB_COORDS...')
}

check()
