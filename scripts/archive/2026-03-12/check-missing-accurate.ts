import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

// From actual SUBURB_COORDS in ListingsClient.tsx (extracted manually)
const SUBURB_COORDS = new Set([
  "chippendale", "burwood", "north sydney", "waterloo", "chatswood",
  "surry hills", "hurstville", "mosman", "liverpool", "bondi junction",
  "zetland", "pymble", "wahroonga", "rosebery", "haymarket", "epping",
  "manly", "newtown", "pyrmont", "gordon", "darlinghurst", "strathfield",
  "cronulla", "blacktown", "alexandria", "sydney", "parramatta",
  "maroubra", "randwick", "wolli creek", "double bay", "wentworth point",
  "kensington", "coogee", "the rocks", "rushcutters bay", "elizabeth bay",
  "kirribilli", "millers point", "mcmahons point", "lavender bay",
  "balmain", "lilyfield", "rozelle", "drummoyne", "five dock", "concord",
  "hunters hill", "forest lodge", "glebe", "annandale", "leichhardt",
  "erskineville", "enmore", "stanmore", "petersham", "summer hill",
  "dulwich hill", "marrickville", "sydenham", "st peters", "tempe",
  "botany", "pagewood", "hillsdale", "eastgardens", "kingsford",
  "malabar", "chifley", "phillip bay", "little bay", "la perouse",
  "port botany", "beecroft", "carlingford", "eastwood", "ryde", "marsfield",
  "artarmon", "roseville", "willoughby", "crows nest", "st leonards",
  "castlecrag", "rhodes", "meadowbank", "north strathfield", "newington",
  "sydney olympic park", "auburn", "silverwater", "lidcombe", "regents park",
  "ashfield", "bondi", "camperdown", "campsie", "cremorne", "croydon",
  "dee why", "drummoyne", "five dock", "gladesville", "haberfield", "homebush",
  "kensington", "killara", "kogarah", "leichhardt", "lindfield", "neutral bay",
  "northbridge", "paddington", "potts point", "redfern", "st peters",
  "stanmore", "enmore", "tempe", "sydenham", "petersham", "lewisham",
  "dulwich hill", "summer hill", "ultimo", "vaucluse", "penrith",
  "macquarie park", "bellevue hill", "castle hill", "bronte", "beaconsfield",
  "dover heights", "tamarama", "turramurra", "centennial park", "clovelly",
  "queens park", "birchgrove", "denistone east", "chester hill", "woolloomooloo"
])

async function check() {
  const { data: listings } = await supabase
    .from('listings')
    .select('suburb')
    .eq('is_active', true)
    .not('current_price', 'is', null)
    .gt('current_price', 0)

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

  console.log('=== Suburbs STILL MISSING from SUBURB_COORDS ===\n')
  for (const m of missingCoords) {
    console.log(`"${m.suburb}": ${m.count} listings`)
  }
  
  console.log(`\nTotal: ${missingCoords.length} suburbs still missing coords`)
}

check()
