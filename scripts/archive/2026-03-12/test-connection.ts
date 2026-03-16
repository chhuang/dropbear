#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

async function main() {
  const { data, error } = await supabase.from('apify_runs').select('*').limit(1)
  console.log(JSON.stringify({ data, error }, null, 2))
}

main()
