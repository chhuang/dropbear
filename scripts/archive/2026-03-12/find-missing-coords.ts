import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

// From ListingsClient.tsx SUBURB_COORDS
const SUBURB_COORDS = new Set([
  "chippendale", "burwood", "north sydney", "waterloo", "chatswood",
  "surry hills", "hurstville", "mosman", "liverpool", "bondi junction",
  "zetland", "pymble", "wahroonga", "rosebery", "haymarket", "epping",
  "manly", "newtown", "pyrmont", "gordon", "darlinghurst", "strathfield",
  "cronulla", "blacktown", "alexandria", "sydney", "parramatta",
  "maroubra", "randwick", "wolli creek", "double bay", "wentworth point",
  "kensington", "woolloomooloo", "coogee", "the rocks", "rushcutters bay",
  "elizabeth bay", "kirribilli", "millers point", "mcmahons point",
  "lavender bay", "balmain", "lilyfield", "rozelle", "drummoyne",
  "five dock", "concord", "hunters hill", "forest lodge", "glebe",
  "annandale", "leichhardt", "erskineville", "newtown", "enmore",
  "stanmore", "petersham", "summer hill", "dulwich hill", "marrickville",
  "sydenham", "st peters", "tempe", "botany", "pagewood", "hillsdale",
  "eastgardens", "kingsford", "kensington", "malabar", "chifley",
  "phillip bay", "little bay", "la perouse", "port botany"
])

async function check() {
  const { data: listings } = await supabase
    .from('listings')
    .select('suburb')
    .eq('is_active', true)

  const suburbCounts: Record<string, number> = {}
  for (const l of listings || []) {
    const normalized = l.suburb.toLowerCase().replace(/-/g, ' ')
    suburbCounts[normalized] = (suburbCounts[normalized] || 0) + 1
  }

  const missingCoords: Array<{suburb: string, count: number}> = []
  for (const [suburb, count] of Object.entries(suburbCounts)) {
    if (!SUBURB_COORDS.has(suburb)) {
      missingCoords.push({ suburb, count })
    }
  }

  missingCoords.sort((a, b) => b.count - a.count)

  console.log('=== Suburbs MISSING from SUBURB_COORDS ===\n')
  for (const m of missingCoords) {
    console.log(`"${m.suburb}": ${m.count} listings`)
  }
  
  console.log(`\nTotal: ${missingCoords.length} suburbs missing coords`)
}

check()
