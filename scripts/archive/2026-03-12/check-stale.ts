import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  // Get last run for each suburb
  const { data: runs } = await supabase
    .from('apify_runs')
    .select('suburb, finished_at, status, listings_found')
    .order('finished_at', { ascending: false })
  
  // Get latest run per suburb
  const latestBySuburb: Record<string, any> = {}
  for (const run of runs || []) {
    const suburb = run.suburb?.toLowerCase().replace(/-/g, ' ')
    if (!latestBySuburb[suburb]) {
      latestBySuburb[suburb] = run
    }
  }
  
  // Get all active suburbs with listings
  const { data: listings } = await supabase
    .from('listings')
    .select('suburb')
    .eq('is_active', true)
  
  const suburbCounts: Record<string, number> = {}
  for (const l of listings || []) {
    const suburb = l.suburb?.toLowerCase()
    if (suburb) suburbCounts[suburb] = (suburbCounts[suburb] || 0) + 1
  }
  
  const now = new Date()
  const stale: Array<{suburb: string, listings: number, lastScrape: string, hoursAgo: number}> = []
  const fresh: Array<{suburb: string, listings: number, lastScrape: string}> = []
  const never: Array<{suburb: string, listings: number}> = []
  
  for (const [suburb, count] of Object.entries(suburbCounts)) {
    const lastRun = latestBySuburb[suburb]
    
    if (!lastRun) {
      never.push({ suburb, listings: count })
    } else {
      const lastScrape = new Date(lastRun.finished_at)
      const hoursAgo = Math.round((now.getTime() - lastScrape.getTime()) / (1000 * 60 * 60))
      
      if (hoursAgo > 24) {
        stale.push({ suburb, listings: count, lastScrape: lastScrape.toISOString().split('T')[0], hoursAgo })
      } else {
        fresh.push({ suburb, listings: count, lastScrape: lastScrape.toISOString().split('T')[0] })
      }
    }
  }
  
  stale.sort((a, b) => b.listings - a.listings)
  never.sort((a, b) => b.listings - a.listings)
  
  console.log('=== STALE (>24h) ===\n')
  for (const s of stale) {
    console.log(`${s.suburb.padEnd(20)} ${String(s.listings).padStart(4)} listings  (${s.hoursAgo}h ago, ${s.lastScrape})`)
  }
  
  console.log(`\n=== NEVER SCRAPED ===\n`)
  for (const s of never.slice(0, 15)) {
    console.log(`${s.suburb.padEnd(20)} ${String(s.listings).padStart(4)} listings`)
  }
  if (never.length > 15) console.log(`... and ${never.length - 15} more`)
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Stale (>24h): ${stale.length}`)
  console.log(`Never scraped: ${never.length}`)
  console.log(`Fresh (<24h): ${fresh.length}`)
}

check()
