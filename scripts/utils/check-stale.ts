import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Get all apify_runs to find last scrape per suburb
  const { data: runs, error: runsError } = await supabase
    .from('apify_runs')
    .select('suburb, finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
  
  if (runsError) {
    console.error('Error fetching runs:', runsError)
    return
  }
  
  // Get unique suburbs with their latest run
  const suburbLastScrape: Record<string, string> = {}
  for (const run of runs || []) {
    if (run.suburb && !suburbLastScrape[run.suburb]) {
      suburbLastScrape[run.suburb] = run.finished_at
    }
  }
  
  // Get listing counts per suburb (active = seen in last 30 days)
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('suburb')
    .gt('last_seen_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  
  if (listingsError) {
    console.error('Error fetching listings:', listingsError)
    return
  }
  
  const suburbCounts: Record<string, number> = {}
  for (const l of listings || []) {
    if (l.suburb) {
      suburbCounts[l.suburb] = (suburbCounts[l.suburb] || 0) + 1
    }
  }
  
  const now = new Date()
  const staleHours = 24
  
  interface SuburbInfo {
    suburb: string
    count: number
    lastScrape: string | null
    hoursAgo: number | null
  }
  
  const results: SuburbInfo[] = []
  
  for (const [suburb, count] of Object.entries(suburbCounts)) {
    const lastScrape = suburbLastScrape[suburb] || null
    const hoursAgo = lastScrape ? Math.floor((now.getTime() - new Date(lastScrape).getTime()) / (1000 * 60 * 60)) : null
    results.push({ suburb, count, lastScrape, hoursAgo })
  }
  
  // Sort by hours ago (stale first)
  results.sort((a, b) => {
    if (a.hoursAgo === null) return -1
    if (b.hoursAgo === null) return 1
    return b.hoursAgo - a.hoursAgo
  })
  
  console.log('\n=== ALL SUBURBS BY FRESHNESS ===\n')
  console.log('Status | Suburb                    | Listings | Last Scrape  | Hours Ago')
  console.log('-------|---------------------------|----------|--------------|----------')
  
  for (const r of results) {
    const stale = r.hoursAgo === null || r.hoursAgo >= staleHours
    const marker = stale ? '⚠️ STALE' : '✅ FRESH'
    const lastStr = r.lastScrape ? r.lastScrape.split('T')[0] : 'NEVER'
    const hoursStr = r.hoursAgo !== null ? `${r.hoursAgo}h` : 'never'
    console.log(`${marker.padEnd(7)} | ${(r.suburb || 'unknown').padEnd(25)} | ${(r.count.toString()).padEnd(8)} | ${lastStr.padEnd(12)} | ${hoursStr}`)
  }
  
  const stale = results.filter(r => r.hoursAgo === null || r.hoursAgo! >= staleHours)
  const fresh = results.filter(r => r.hoursAgo !== null && r.hoursAgo! < staleHours)
  
  console.log('\n=== SUMMARY ===')
  console.log(`Total suburbs: ${results.length}`)
  console.log(`Stale (24h+ or never): ${stale.length}`)
  console.log(`Fresh (<24h): ${fresh.length}`)
  
  if (stale.length > 0) {
    console.log('\n=== SAFE-SCRAPE COMMANDS FOR STALE SUBURBS ===')
    for (const s of stale) {
      // Need to find postcode - let's skip for now
      console.log(`# ${s.suburb} (${s.count} listings, last: ${s.lastScrape ? s.lastScrape.split('T')[0] : 'never'})`)
    }
  }
}

main()
