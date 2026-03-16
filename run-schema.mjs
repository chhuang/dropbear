import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://pfmziwdqslxgkyszgdah.supabase.co';
const supabaseKey = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSchema() {
  // Read the entire schema
  const schema = fs.readFileSync('/root/.openclaw/workspace/projects/dropbear/supabase/schema.sql', 'utf8');
  
  // Split into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
  
  console.log(`Running ${statements.length} statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        console.log(`Statement ${i +1}/${statements.length}: Error - ${error.message.substring(0, 100)}`);
      } else {
        console.log(`Statement ${i+1}/${statements.length}: Success`);
      }
    } catch (err) {
      console.log(`Statement ${i+1}/${statements.length}: Exception- ${err.message.substring(0, 100)}`);
    }
  }
  
  console.log('Schema migration completed!');
}

runSchema();
