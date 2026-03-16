import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
)

async function main() {
  // Get sample record
  const { data, error } = await supabase
    .from('apify_runs')
    .select('*')
    .limit(3)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('=== APIFY_RUNS TABLE SAMPLE ===\n')
  console.log('Columns:', Object.keys(data?.[0] || {}).join(', '))
  console.log('\nSample records:')
  console.log(JSON.stringify(data, null, 2))
  
  // Count
  const { count } = await supabase.from('apify_runs').select('*', { count: 'exact', head: true })
  console.log(`\nTotal records: ${count}`)
}

main()
