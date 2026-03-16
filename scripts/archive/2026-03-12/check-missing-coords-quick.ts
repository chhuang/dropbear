#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import coords from './web/src/data/suburb-coords.json' with { type: 'json' }

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Get all active suburbs with priced listings
  const { data } = await supabase
    .from('listings')
    .select('suburb')
    .eq('is_active', true)
    .gt('current_price', 0)
  
  const dbSuburbs = [...new Set(data?.map(r => r.suburb) || [])]
  const coordSuburbs = Object.keys(coords)
  
  console.log(`DB suburbs with listings: ${dbSuburbs.length}`)
  console.log(`Coords file suburbs: ${coordSuburbs.length}\n`)
  
  // Find missing (not in coords file)
  const missing = dbSuburbs.filter(s => !coordSuburbs.includes(s))
  
  if (missing.length === 0) {
    console.log('✅ All suburbs have coordinates')
  } else {
    console.log(`⚠️  Missing coordinates for ${missing.length} suburbs:`)
    missing.forEach(s => console.log(`  - ${s}`))
  }
}

check()
