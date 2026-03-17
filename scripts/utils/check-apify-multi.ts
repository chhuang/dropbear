import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
)

async function main() {
  const { data: runs, error } = await supabase
    .from('apify_runs')
    .select('id, suburb, listings_found, listings_new, listings_dropped, finished_at, trigger')
    .order('finished_at', { ascending: false })
    .limit(30)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('=== RECENT APIFY RUNS ===\n')
  console.log('ID'.padEnd(30) + 'Suburb'.padEnd(15) + 'Found'.padEnd(8) + 'New'.padEnd(6) + 'Dropped'.padEnd(8) + 'Trigger'.padEnd(10) + 'Finished At')
  console.log('-'.repeat(100))
  
  for (const run of runs) {
    console.log(
      run.id.padEnd(30) +
      (run.suburb || '').padEnd(15) +
      (run.listings_found || 0).toString().padEnd(8) +
      (run.listings_new || 0).toString().padEnd(6) +
      (run.listings_dropped || 0).toString().padEnd(8) +
      (run.trigger || '').padEnd(10) +
      (run.finished_at ? new Date(run.finished_at).toLocaleString() : 'null')
    )
  }
  
  // Check if any runs have the same finished_at timestamp (potential batch runs)
  console.log('\n=== CHECKING FOR BATCH RUNS (same timestamp) ===\n')
  const runsByTime: Record<string, any[]> = {}
  for (const run of runs) {
    const timeKey = run.finished_at ? run.finished_at.substring(0, 16) : 'null' // Group by minute
    if (!runsByTime[timeKey]) runsByTime[timeKey] = []
    runsByTime[timeKey].push(run)
  }
  
  let batchCount = 0
  for (const [time, timeRuns] of Object.entries(runsByTime)) {
    if (timeRuns.length > 1) {
      batchCount++
      console.log(`Time: ${time} (${timeRuns.length} runs):`)
      for (const run of timeRuns) {
        console.log(`  ${run.suburb} (${run.listings_found} found)`)
      }
      console.log('')
    }
  }
  
  if (batchCount === 0) {
    console.log('No batch runs detected (all runs have unique timestamps)')
  } else {
    console.log(`Found ${batchCount} potential batch run times`)
  }
  
  // Show what batch-scrape.ts does conceptually
  console.log('\n=== BATCH SCRAPE CONCEPT ===')
  console.log('Batch scraping means:')
  console.log('1. Multiple suburbs in ONE Apify run (saves cost)')
  console.log('2. Results still need to be split by suburb for DB storage')
  console.log('3. apify_runs table would need modification:')
  console.log('   - Either one run record with multiple suburbs')
  console.log('   - Or multiple run records pointing to same apify_run_id')
  console.log('4. price_history table unaffected - still per listing')
}

main()
