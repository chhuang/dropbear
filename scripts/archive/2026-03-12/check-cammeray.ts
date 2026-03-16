import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Check all Cammeray listings
  const { data: all } = await supabase
    .from('listings')
    .select('id, suburb, current_price, is_active')
    .ilike('suburb', '%cammeray%')

  console.log('Total Cammeray listings:', all?.length || 0)
  
  const active = all?.filter(l => l.is_active) || []
  const withPrice = active.filter(l => l.current_price && l.current_price > 0)
  
  console.log('Active:', active.length)
  console.log('With price > 0:', withPrice.length)
}

check()
