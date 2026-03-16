import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('apify_runs')
    .select('id, suburb, status, error, listings_found, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
