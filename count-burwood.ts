import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
);

async function main() {
  const { count, error } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('suburb', 'Burwood');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Listings in Burwood:', count);
}

main();
