import dotenv from 'dotenv';

dotenv.config({ path: '/root/.openclaw/workspace/projects/dropbear/web/.env.local' });

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!APIFY_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing credentials');
  process.exit(1);
}

const suburbs = [
  { name: 'Millers Point', runId: '95rqLCFclA18k3ef4', datasetId: 'ypoI7NpPAbjp2RjEN' },
  { name: 'The Rocks', runId: 'Jf5FEUEbdU9uugBXG', datasetId: 'kBTwAgaZe4LMlZsHo' },
  { name: 'Beaconsfield', runId: '3HieaxcUPG55gLLpV', datasetId: '54JvWtrCgpwJjFBtG' },
  { name: 'Forest Lodge', runId: 'BvLR0PKhjm8CvHCW6', datasetId: null },
  { name: 'Rosebery', runId: '8uWcon5Q5DgMSd2Jh', datasetId: null }
];

function extractListingId(url) {
  const match = url.match(/(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

async function fetchDataset(datasetId) {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset ${datasetId}: ${response.statusText}`);
  }
  return await response.json();
}

async function getDatasetFromRun(runId) {
  const url = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch run ${runId}: ${response.statusText}`);
  }
  const json = await response.json();
  return json.data.defaultDatasetId;
}

function transformListing(item, suburbName) {
  const listingId = extractListingId(item.url);
  if (!listingId) {
    console.error(`  ⚠️  Could not extract listing_id from ${item.url}`);
    return null;
  }

  return {
    listing_id: listingId,
    url: item.url,
    source: 'domain.com.au',
    suburb: suburbName,
    state: item.address?.state || 'NSW',
    postcode: item.address?.postcode || '2000',
    address: item.address?.street || null,
    title: null,
    property_type: item.features?.propertyTypeFormatted || null,
    bedrooms: item.features?.beds || null,
    bathrooms: item.features?.baths || null,
    car_spaces: null,
    building_size: null,
    land_size: item.features?.landSize || null,
    price_text: item.price || null,
    current_price: null,
    initial_price: null,
    inspection_times: item.inspection?.openTime ? [{ date: item.inspection.openTime }] : null,
    auction_at: item.auction || null,
    images: item.images || [],
    is_active: true
  };
}

async function upsertListings(listings) {
  const url = `${SUPABASE_URL}/rest/v1/listings?apikey=${SUPABASE_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(listings)
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('  ❌ Upsert error:', error);
    return { success: false, error };
  }
  
  return { success: true };
}

async function updateApifyRun(runId, listingsFound, listingsNew, suburbName, postcode, datasetId) {
  const url = `${SUPABASE_URL}/rest/v1/apify_runs?apikey=${SUPABASE_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      suburb: suburbName,
      state: 'NSW',
      postcode: postcode,
      finished_at: new Date().toISOString(),
      listings_found: listingsFound,
      listings_new: listingsNew,
      apify_run_id: runId,
      apify_dataset_id: datasetId,
      trigger: 'manual'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`  ⚠️  Failed to insert apify_runs: ${error}`);
    return false;
  }
  
  return true;
}

async function countNewListings(listingIds) {
  const url = `${SUPABASE_URL}/rest/v1/listings?select=listing_id&listing_id=in.(${listingIds.join(',')})&apikey=${SUPABASE_KEY}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error('  ⚠️  Error checking existing listings');
    return listingIds.length;
  }
  
  const data = await response.json();
  const existingIds = new Set(data.map(l => l.listing_id));
  return listingIds.filter(id => !existingIds.has(id)).length;
}

async function main() {
  console.log('🦞 DropBear Suburb Sync\n');
  
  for (const suburb of suburbs) {
    console.log(`📍 Processing ${suburb.name}...`);
    
    try {
      let datasetId = suburb.datasetId;
      if (!datasetId) {
        console.log(`  Fetching dataset ID for run ${suburb.runId}...`);
        datasetId = await getDatasetFromRun(suburb.runId);
        console.log(`  Dataset ID: ${datasetId}`);
      }
      
      console.log(`  Fetching dataset...`);
      const items = await fetchDataset(datasetId);
      console.log(`  Found ${items.length} listings`);
      
      if (items.length === 0) {
        console.log(`  ⚠️  No listings found, skipping\n`);
        continue;
      }
      
      const listings = items
        .map(item => transformListing(item, suburb.name))
        .filter(l => l !== null);
      
      console.log(`  Transformed ${listings.length} listings`);
      
      const listingIds = listings.map(l => l.listing_id);
      const listingsNew = await countNewListings(listingIds);
      console.log(`  New listings: ${listingsNew}`);
      
      console.log(`  Upserting to Supabase...`);
      const result = await upsertListings(listings);
      
      // Insert apify_runs record regardless of whether listings were new
      const postcode = listings[0]?.postcode || '2000';
      const updated = await updateApifyRun(suburb.runId, items.length, listingsNew, suburb.name, postcode, datasetId);
      
      if (result.success) {
        console.log(`  ✅ Successfully synced ${listings.length} listings (${listingsNew} new)`);
        if (updated) {
          console.log(`  ✅ Inserted apify_runs record`);
        }
      } else {
        // Listings may already exist, but still record the run
        if (updated) {
          console.log(`  ✅ Inserted apify_runs record (${listingsNew} new listings)`);
        }
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
    
    console.log();
  }
  
  console.log('🦞 Sync complete!');
}

main().catch(console.error);
