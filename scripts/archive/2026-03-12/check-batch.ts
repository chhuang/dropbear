import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  const suburbs = ['vaucluse', 'rose bay', 'bellevue hill']
  
  for (const suburb of suburbs) {
    const { data } = await supabase
      .from('listings')
      .select('id, current_price, is_active')
      .ilike('suburb', `%${suburb.replace(' ', '%')}%`)
    
    const active = data?.filter(l => l.is_active) || []
    const withPrice = active.filter(l => l.current_price && l.current_price > 0)
    
    console.log(`${suburb}: ${active.length} active, ${withPrice.length} with price`)
  }
}

check()
