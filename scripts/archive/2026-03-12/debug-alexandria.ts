import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Get distinct suburb names and counts
  const { data: listings } = await supabase
    .from('listings')
    .select('suburb')
    .eq('is_active', true)

  // Count by suburb
  const counts: Record<string, number> = {}
  for (const l of listings || []) {
    counts[l.suburb] = (counts[l.suburb] || 0) + 1
  }

  // Check Alexandria variations
  console.log('=== Suburbs containing "alexandria" ===')
  for (const [suburb, count] of Object.entries(counts)) {
    if (suburb.toLowerCase().includes('alexandria')) {
      console.log(`"${suburb}": ${count}`)
    }
  }

  // Check if "alexandria" exists exactly
  console.log('\n=== Exact "alexandria" (lowercase) ===')
  console.log(`"${'alexandria'}": ${counts['alexandria'] || 0}`)

  // Check if "Alexandria" exists exactly  
  console.log('\n=== Exact "Alexandria" (title case) ===')
  console.log(`"${'Alexandria'}": ${counts['Alexandria'] || 0}`)
}

check()
