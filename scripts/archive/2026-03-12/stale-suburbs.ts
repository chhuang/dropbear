import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function main() {
  const { data: runs } = await supabase
    .from('apify_runs')
    .select('suburb_id, finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false });

  const { data: suburbs } = await supabase.from('suburbs').select('id, name');
  const suburbMap = new Map(suburbs?.map(s => [s.id, s.name]) || []);

  const latestBySuburb = new Map();
  for (const run of runs || []) {
    if (!latestBySuburb.has(run.suburb_id)) {
      latestBySuburb.set(run.suburb_id, run.finished_at);
    }
  }

  const { data: stats } = await supabase
    .from('listings')
    .select('suburb_id')
    .not('current_price', 'is', null);

  const countBySuburb = new Map();
  for (const s of stats || []) {
    countBySuburb.set(s.suburb_id, (countBySuburb.get(s.suburb_id) || 0) + 1);
  }

  const now = new Date();
  const results: any[] = [];
  for (const [suburbId, name] of suburbMap) {
    const lastScrape = latestBySuburb.get(suburbId);
    const count = countBySuburb.get(suburbId) || 0;
    if (lastScrape && count > 0) {
      const hoursAgo = Math.round((now.getTime() - new Date(lastScrape).getTime()) / (1000 * 60 * 60));
      results.push({ name, count, hoursAgo });
    }
  }

  results.sort((a, b) => b.hoursAgo - a.hoursAgo);

  console.log('| Suburb | Listings | Stale |');
  console.log('|--------|----------|-------|');
  for (const r of results.slice(0, 25)) {
    const days = Math.floor(r.hoursAgo / 24);
    const display = days > 0 ? `${days}d ${r.hoursAgo % 24}h` : `${r.hoursAgo}h`;
    console.log(`| ${r.name} | ${r.count} | ${display} |`);
  }
}

main();
