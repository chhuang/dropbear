import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
)

async function check() {
  const { data } = await supabase
    .from('apify_runs')
    .select('suburb, finished_at, listings_found, apify_run_id')
    .order('finished_at', { ascending: false })
    .limit(10)
  
  console.log('Recent Apify runs:\n')
  for (const r of data || []) {
    console.log(`${r.suburb?.padEnd(20)} | ${r.listings_found?.toString().padStart(4)} listings | ${r.finished_at}`)
  }
}

check()
