#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  const { data, error } = await supabase
    .from('suburbs')
    .select('*')
    .in('name', ['Potts Point', 'Darling Point', 'Point Piper'])
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Suburbs in DB:', JSON.stringify(data, null, 2))
  
  if (!data || data.length === 0) {
    console.log('\n⚠️  These suburbs are NOT in the suburbs table - need to add them first')
  }
}

check()
