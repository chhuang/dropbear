#!/usr/bin/env npx tsx
/**
 * Run the custom Domain scraper actor
 * This script calls your Apify actor (once deployed) and syncs results to Supabase
 * 
 * Usage: npx tsx run-actor.ts <suburb> <postcode>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../web/.env.local' });

const APIFY_TOKEN = process.env.APIFY_TOKEN || '6vBNK4evANPCjs9WMur2SkD6C';
const ACTOR_ID = process.env.ACTOR_ID || 'precocious_lilac/domain-com-au-scraper'; // Your custom actor

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function runActor(suburb: string, postcode: string, state: string = 'nsw') {
  const startTime = Date.now();
  console.log(`\n=== Custom Domain Actor ===`);
  console.log(`Suburb: ${suburb}, ${state.toUpperCase()} ${postcode}`);
  console.log(`Started: ${new Date().toISOString()}`);
  
  // Start actor run
  console.log('\nStarting Apify run...');
  const startRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suburb,
      postcode,
      state,
      excludeUnderOffer: true,
      proxyConfiguration: { useApifyProxy: true },
    }),
  });
  
  if (!startRes.ok) {
    const error = await startRes.text();
    console.error('Failed to start actor:', error);
    return;
  }
  
  const run = await startRes.json();
  const runId = run.data.id;
  console.log(`Run ID: ${runId}`);
  
  // Poll for completion
  let status = 'RUNNING';
  while (['RUNNING', 'READY'].includes(status)) {
    await new Promise(r => setTimeout(r, 10000));
    
    const statusRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${APIFY_TOKEN}`);
    const statusData = await statusRes.json();
    status = statusData.data.status;
    console.log(`  Status: ${status}`);
  }
  
  if (status !== 'SUCCEEDED') {
    console.error(`Run failed with status: ${status}`);
    return;
  }
  
  // Get dataset
  const datasetId = run.data.defaultDatasetId;
  const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`);
  const listings = await datasetRes.json();
  
  console.log(`\nFetched ${listings.length} items`);
  
  // Sync to Supabase
  let newCount = 0;
  let updateCount = 0;
  
  for (const listing of listings) {
    if (!listing.listing_id) continue;
    
    const { data: existing } = await supabase
      .from('listings')
      .select('id, current_price')
      .eq('listing_id', listing.listing_id)
      .single();
    
    if (existing) {
      if (listing.price && existing.current_price !== listing.price) {
        await supabase
          .from('listings')
          .update({
            current_price: listing.price,
            price_text: listing.price_text,
            updated_at: new Date().toISOString(),
          })
          .eq('listing_id', listing.listing_id);
        updateCount++;
      }
    } else {
      await supabase.from('listings').insert({
        listing_id: listing.listing_id,
        url: listing.url,
        title: '',
        suburb: listing.suburb,
        postcode: listing.postcode,
        state: listing.state,
        initial_price: listing.price,
        current_price: listing.price,
        price_text: listing.price_text,
        address: listing.address,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        car_spaces: listing.car_spaces,
        property_type: listing.property_type,
        image_url: listing.image_url,
      });
      newCount++;
    }
  }
  
  // Log run
  await supabase.from('apify_runs').insert({
    suburb,
    postcode,
    state,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    trigger: 'manual',
    listings_found: listings.length,
    listings_new: newCount,
    listings_dropped: 0,
    apify_run_id: runId,
    apify_dataset_id: datasetId,
  });
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n=== Sync Complete ===`);
  console.log(`Found: ${listings.length}`);
  console.log(`New: ${newCount}`);
  console.log(`Updated: ${updateCount}`);
  console.log(`Elapsed: ${elapsed}s`);
}

// Run
const args = process.argv.slice(2);
const suburb = args[0];
const postcode = args[1];
const state = args[2] || 'nsw';

if (!suburb || !postcode) {
  console.log('Usage: npx tsx run-actor.ts <suburb> <postcode> [state]');
  process.exit(1);
}

runActor(suburb, postcode, state).catch(console.error);
