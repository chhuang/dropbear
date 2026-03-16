require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

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
    .filter(s => s && !s.startsWith('--'));
  
  console.log(`Running ${statements.length} statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        console.log(`Statement ${i +1}/${statements.length}: Error - ${error.message}`);
      } else {
        console.log(`Statement ${i+1}/${statements.length}: Success`);
      }
    } catch (err) {
      console.log(`Statement ${i+1}/${statements.length}: Exception- ${err.message}`);
    }
  }
  
  console.log('Schema migration completed!');
}

runSchema();
