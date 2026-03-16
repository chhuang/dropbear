#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function check() {
  const { data, error } = await supabase
    .from('apify_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Recent Apify runs:')
  console.log('ID | Suburb | Status | Items | Started')
  console.log('-'.repeat(60))
  for (const run of data || []) {
    const status = run.finished_at ? (run.error ? 'failed' : 'completed') : 'running'
    const suburb = run.suburb || 'N/A'
    console.log(`${run.id} | ${suburb.padEnd(20)} | ${status.padEnd(9)} | ${(run.listings_found || 0).toString().padStart(3)} | ${run.started_at?.slice(0, 10) || 'N/A'}`)
  }
}

check()
