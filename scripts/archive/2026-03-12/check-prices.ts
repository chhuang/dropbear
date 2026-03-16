import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  const { data: all } = await supabase
    .from('listings')
    .select('id, current_price, price_text')
    .eq('suburb', 'alexandria')
    .eq('is_active', true)

  const withPrice = all?.filter(l => l.current_price && l.current_price > 0) || []
  const noPrice = all?.filter(l => !l.current_price || l.current_price === 0) || []

  console.log(`Total active: ${all?.length || 0}`)
  console.log(`With current_price: ${withPrice.length}`)
  console.log(`Without current_price: ${noPrice.length}`)
  
  console.log('\nSample without price:')
  noPrice.slice(0, 3).forEach(l => {
    console.log(`  price_text: ${l.price_text}`)
  })
}

check()
