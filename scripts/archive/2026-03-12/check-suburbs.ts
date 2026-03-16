#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  const suburbs = ['Potts Point', 'Darling Point', 'Point Piper']
  
  for (const suburb of suburbs) {
    const { count: total } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('suburb', suburb)
    
    const { count: withPrice } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('suburb', suburb)
      .gt('current_price', 0)
      .eq('is_active', true)
    
    console.log(`${suburb}: ${total} total, ${withPrice} active with price`)
  }
}

check()
