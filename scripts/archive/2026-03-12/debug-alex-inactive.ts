import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Get all Alexandria listings (active and inactive)
  const { data: active } = await supabase
    .from('listings')
    .select('id, listing_id, suburb')
    .eq('suburb', 'alexandria')
    .eq('is_active', true)

  const { data: inactive } = await supabase
    .from('listings')
    .select('id, listing_id, suburb')
    .eq('suburb', 'alexandria')
    .eq('is_active', false)

  console.log(`Active: ${active?.length || 0}`)
  console.log(`Inactive: ${inactive?.length || 0}`)

  // Check for other variations
  const { data: allAlex } = await supabase
    .from('listings')
    .select('id, suburb, is_active')
    .ilike('suburb', '%alexandria%')

  console.log('\nAll Alexandria variations:')
  const grouped: Record<string, {active: number, inactive: number}> = {}
  for (const l of allAlex || []) {
    if (!grouped[l.suburb]) grouped[l.suburb] = {active: 0, inactive: 0}
    if (l.is_active) grouped[l.suburb].active++
    else grouped[l.suburb].inactive++
  }
  for (const [suburb, counts] of Object.entries(grouped)) {
    console.log(`  "${suburb}": ${counts.active} active, ${counts.inactive} inactive`)
  }
}

check()
