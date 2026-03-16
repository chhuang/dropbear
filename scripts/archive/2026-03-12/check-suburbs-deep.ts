#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  // Check exact matches
  const suburbs = ['Potts Point', 'Darling Point', 'Point Piper']
  
  for (const suburb of suburbs) {
    const { count: exact } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('suburb', suburb)
    
    // Check case-insensitive
    const { data: ilike } = await supabase
      .from('listings')
      .select('suburb')
      .ilike('suburb', `%${suburb.toLowerCase()}%`)
      .limit(5)
    
    console.log(`${suburb}: exact=${exact}, ilike samples: ${ilike?.map(r => r.suburb).join(', ') || 'none'}`)
  }
  
  // Check what Potts-related suburbs exist
  const { data: potts } = await supabase
    .from('listings')
    .select('suburb')
    .ilike('suburb', '%potts%')
  
  console.log('\nAll Potts-related:', [...new Set(potts?.map(r => r.suburb))])
  
  const { data: darling } = await supabase
    .from('listings')
    .select('suburb')
    .ilike('suburb', '%darling%')
  
  console.log('All Darling-related:', [...new Set(darling?.map(r => r.suburb))])
  
  const { data: piper } = await supabase
    .from('listings')
    .select('suburb')
    .ilike('suburb', '%piper%')
  
  console.log('All Piper-related:', [...new Set(piper?.map(r => r.suburb))])
}

check()
