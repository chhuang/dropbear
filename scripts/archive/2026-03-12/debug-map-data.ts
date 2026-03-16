#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import coords from './web/src/data/suburb-coords.json' with { type: 'json' }

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Get active listings grouped by suburb
  const { data } = await supabase
    .from('listings')
    .select('suburb, current_price')
    .eq('is_active', true)
    .gt('current_price', 0)
  
  const grouped: Record<string, number> = {}
  for (const row of data || []) {
    grouped[row.suburb] = (grouped[row.suburb] || 0) + 1
  }
  
  const testSuburbs = ['potts point', 'darling point', 'point piper']
  
  for (const suburb of testSuburbs) {
    const hasCoords = !!coords[suburb]
    const count = grouped[suburb] || 0
    const inMapData = hasCoords && count > 0
    
    console.log(`${suburb}:`)
    console.log(`  Listings: ${count}`)
    console.log(`  Has coords: ${hasCoords}`)
    console.log(`  Would be in mapData: ${inMapData}`)
  }
}

check()
