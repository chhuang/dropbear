#!/usr/bin/env npx tsx
// Simulate what the map component does
import coords from './web/src/data/suburb-coords.json' with { type: 'json' }
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Get listings like the page does
  const { data } = await supabase
    .from('listings')
    .select('suburb, current_price')
    .eq('is_active', true)
    .gt('current_price', 0)
  
  // Group by suburb
  const grouped: Record<string, number> = {}
  for (const row of data || []) {
    grouped[row.suburb] = (grouped[row.suburb] || 0) + 1
  }
  
  // Build mapData (same logic as ListingsClient.tsx)
  const mapData = Object.entries(grouped)
    .filter(([suburb]) => coords[suburb])
    .map(([suburb, count]) => ({
      name: suburb,
      count,
    }))
  
  console.log('Total suburbs in mapData:', mapData.length)
  
  // Check if our target suburbs are there
  const targets = ['potts point', 'darling point', 'point piper']
  for (const t of targets) {
    const found = mapData.find(m => m.name === t)
    console.log(`${t}: ${found ? `YES (${found.count} listings)` : 'NO'}`)
  }
  
  // Build suburbNames set (same as MapComponent.tsx)
  const suburbNames = new Set(mapData.map(d => d.name.toLowerCase()))
  
  console.log('\n"potts point" in suburbNames set:', suburbNames.has('potts point'))
  console.log('"darling point" in suburbNames set:', suburbNames.has('darling point'))
  console.log('"point piper" in suburbNames set:', suburbNames.has('point piper'))
}

check()
