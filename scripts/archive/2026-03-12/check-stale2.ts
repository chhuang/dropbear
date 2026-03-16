import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

function normalize(s: string): string {
  return s.toLowerCase().replace(/-/g, ' ').trim()
}

async function check() {
  // Get all runs
  const { data: runs } = await supabase
    .from('apify_runs')
    .select('suburb, finished_at, listings_found')
  
  // Build last scrape time by normalized suburb
  const lastScrape: Record<string, Date> = {}
  for (const run of runs || []) {
    if (!run.suburb || !run.finished_at) continue
    const suburb = normalize(run.suburb)
    const date = new Date(run.finished_at)
    if (!lastScrape[suburb] || date > lastScrape[suburb]) {
      lastScrape[suburb] = date
    }
  }
  
  // Get all active listings
  const { data: listings } = await supabase
    .from('listings')
    .select('suburb, current_price')
    .eq('is_active', true)
  
  const suburbData: Record<string, {total: number, withPrice: number}> = {}
  for (const l of listings || []) {
    const suburb = normalize(l.suburb || '')
    if (!suburb) continue
    if (!suburbData[suburb]) suburbData[suburb] = { total: 0, withPrice: 0 }
    suburbData[suburb].total++
    if (l.current_price && l.current_price > 0) suburbData[suburb].withPrice++
  }
  
  const now = new Date()
  const stale: Array<{suburb: string, total: number, withPrice: number, hoursAgo: number, lastScrape: string}> = []
  const never: Array<{suburb: string, total: number, withPrice: number}> = []
  const fresh: Array<{suburb: string, total: number, withPrice: number}> = []
  
  for (const [suburb, data] of Object.entries(suburbData)) {
    const last = lastScrape[suburb]
    
    if (!last) {
      never.push({ suburb, ...data })
    } else {
      const hoursAgo = Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60))
      if (hoursAgo > 24) {
        stale.push({ suburb, ...data, hoursAgo, lastScrape: last.toISOString().split('T')[0] })
      } else {
        fresh.push({ suburb, ...data })
      }
    }
  }
  
  stale.sort((a, b) => b.total - a.total)
  never.sort((a, b) => b.total - a.total)
  
  console.log('=== STALE (>24h) - NEED SCRAPE FOR DROPS ===\n')
  for (const s of stale) {
    console.log(`${s.suburb.padEnd(20)} ${String(s.total).padStart(4)} listings (${s.withPrice} with price)  ${s.hoursAgo}h ago`)
  }
  
  console.log(`\n=== NEVER SCRAPED ===\n`)
  for (const s of never.slice(0, 20)) {
    console.log(`${s.suburb.padEnd(20)} ${String(s.total).padStart(4)} listings (${s.withPrice} with price)`)
  }
  if (never.length > 20) console.log(`... and ${never.length - 20} more`)
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Stale (>24h): ${stale.length} suburbs`)
  console.log(`Never scraped: ${never.length} suburbs`)
  console.log(`Fresh (<24h): ${fresh.length} suburbs`)
}

check()
