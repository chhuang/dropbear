#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  const suburbs = ['potts point', 'darling point', 'point piper']
  
  for (const suburb of suburbs) {
    const { count: total } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('suburb', suburb)
    
    const { count: active } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('suburb', suburb)
      .eq('is_active', true)
      .gt('current_price', 0)
    
    console.log(`${suburb}: ${total} total, ${active} active with price`)
  }
}

check()
