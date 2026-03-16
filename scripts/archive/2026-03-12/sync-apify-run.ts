#!/usr/bin/env npx tsx
/**
 * Create apify_run record and sync dataset
 * Usage: npx tsx sync-apify-run.ts <suburb> <postcode> <apify-run-id> <apify-dataset-id>
 */

import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

function extractListingId(url: string): number {
  const match = url.match(/-(\d+)$/)
  return match ? parseInt(match[1]) : 0
}

function parsePrice(text: any): number | undefined {
  if (!text) return undefined
  if (typeof text === 'number') {
    if (text < 10000) return undefined
    return text
  }
  
  // Skip phone numbers (04XX XXX XXX pattern)
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return undefined
  
  // Strip common prefixes
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction\s*-\s*guide|For Sale\s*\|\s*)/i, '')
  
  // Try price ranges with units ($1.1M-$1.2M, $500K-$600K, $1.1 million to $1.15 million)
  const rangeWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?/i)
  if (rangeWithUnitMatch) {
    let num = parseFloat(rangeWithUnitMatch[1].replace(/,/g, ''))
    const unit = rangeWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  // Try single price with unit ($1.5M, $500K, 1.5 million)
  const singleWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)\b/i)
  if (singleWithUnitMatch) {
    let num = parseFloat(singleWithUnitMatch[1].replace(/,/g, ''))
    const unit = singleWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  // Try plain number with $ sign ($500,000)
  const plainMatch = text.match(/\$([\d,]+(?:\.\d+)?)/)
  if (plainMatch) {
    let num = parseFloat(plainMatch[1].replace(/,/g, ''))
    if (num >= 10000) return Math.round(num)
  }
  
  return undefined
}

function extractAgentPhone(text: any): string | undefined {
  if (!text || typeof text !== 'string') return undefined
  // Match Australian mobile: 04XX XXX XXX or 04XXXXXXXX
  const match = text.match(/04\d{2}[\s]?\d{3}[\s]?\d{3}/)
  return match ? match[0].replace(/\s/g, '') : undefined
}

async function syncRun(suburb: string, postcode: string, apifyRunId: string, apifyDatasetId: string) {
  console.log(`Processing ${suburb} (${postcode})...`)
  console.log(`Apify Run: ${apifyRunId}`)
  console.log(`Dataset: ${apifyDatasetId}`)
  
  // Create or find run record
  const { data: existingRun } = await supabase
    .from('apify_runs')
    .select('*')
    .eq('suburb', suburb)
    .eq('apify_run_id', apifyRunId)
    .single()
  
  let runId: string
  
  if (existingRun) {
    runId = existingRun.id
    console.log(`Found existing run: ${runId}`)
  } else {
    const { data: newRun, error } = await supabase
      .from('apify_runs')
      .insert({
        suburb,
        state: 'nsw',
        postcode,
        started_at: new Date().toISOString(),
        trigger: 'retry',
        apify_run_id: apifyRunId,
        apify_dataset_id: apifyDatasetId,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create run:', error)
      return { success: false, error }
    }
    
    runId = newRun.id
    console.log(`Created run: ${runId}`)
  }
  
  // Fetch dataset
  console.log('Fetching dataset...')
  const items = []
  let offset = 0
  const limit = 1000
  let hasMore = true
  
  while (hasMore) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${apifyDatasetId}/items?token=${APIFY_TOKEN}&offset=${offset}&limit=${limit}&clean=true`
    )
    
    if (!res.ok) {
      console.error(`Failed to fetch dataset: ${res.status}`)
      return { success: false, error: `Failed to fetch dataset: ${res.status}` }
    }
    
    const data = await res.json()
    items.push(...data)
    
    console.log(`  Fetched ${items.length} items...`)
    hasMore = data.length === limit
    offset += limit
  }
  
  console.log(`Total items: ${items.length}`)
  
  // Deduplicate by listing_id
  const seenIds = new Set()
  const uniqueItems = items.filter(item => {
    const listingId = extractListingId(item.url)
    if (!listingId || seenIds.has(listingId)) return false
    seenIds.add(listingId)
    return true
  })
  
  console.log(`Unique listings: ${uniqueItems.length}`)
  
  // Process listings
  const stats = {
    listingsFound: uniqueItems.length,
    listingsNew: 0,
    listingsDropped: 0,
  }
  
  const activeListingIds: number[] = []
  
  for (const item of uniqueItems) {
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    activeListingIds.push(listingId)
    
    const price = parsePrice(item.price)
    const suburbLower = (item.address?.suburb || suburb).toLowerCase()
    const postcodeVal = item.address?.postcode || postcode
    
    // Check if listing exists
    const { data: existing } = await supabase
      .from('listings')
      .select('*')
      .eq('listing_id', listingId)
      .single()
    
    if (existing) {
      // Update existing listing
      const updates: any = {
        price_text: item.price,
        current_price: price,
        is_active: true,
        title: item.title || existing.title,
        property_type: item.features?.propertyTypeFormatted || existing.property_type,
        bedrooms: item.features?.beds || existing.bedrooms,
        bathrooms: item.features?.baths || existing.bathrooms,
        car_spaces: item.features?.parking || existing.car_spaces,
        land_size: item.features?.landSize || existing.land_size,
        building_size: item.buildingSize || existing.building_size,
        agent_name: item.branding?.agentName || existing.agent_name,
        agent_phone: extractAgentPhone(item.price) || existing.agent_phone,
      }
      
      // Add price to history if changed
      if (price && price !== existing.current_price) {
        await supabase.from('listings_price_history').insert({
          listing_id: existing.id,
          price,
          price_text: item.price,
        })
        
        if (existing.current_price && price < existing.current_price) {
          stats.listingsDropped++
        }
      }
      
      await supabase.from('listings').update(updates).eq('id', existing.id)
    } else {
      // Create new listing
      const { data: newListing, error } = await supabase
        .from('listings')
        .insert({
          listing_id: listingId,
          url: item.url,
          source: 'domain.com.au',
          suburb: suburbLower,
          state: 'nsw',
          postcode: postcodeVal,
          address: item.address ? `${item.address.street}, ${item.address.suburb}` : null,
          title: item.title,
          property_type: item.features?.propertyTypeFormatted,
          bedrooms: item.features?.beds,
          bathrooms: item.features?.baths,
          car_spaces: item.features?.parking,
          building_size: item.buildingSize,
          land_size: item.features?.landSize,
          price_text: item.price,
          current_price: price,
          initial_price: price,
          images: item.images?.slice(0, 10),
          agent_name: item.branding?.agentName,
          agent_phone: extractAgentPhone(item.price),
        })
        .select()
        .single()
      
      if (!error && newListing) {
        await supabase.from('listings_price_history').insert({
          listing_id: newListing.id,
          price,
          price_text: item.price,
        })
        
        stats.listingsNew++
      }
    }
  }
  
  // Mark inactive listings
  const { data: existingListings } = await supabase
    .from('listings')
    .select('id, listing_id')
    .eq('suburb', suburb.toLowerCase())
    .eq('state', 'nsw')
    .eq('is_active', true)
  
  if (existingListings) {
    for (const listing of existingListings) {
      if (!activeListingIds.includes(listing.listing_id)) {
        await supabase
          .from('listings')
          .update({ is_active: false })
          .eq('id', listing.id)
      }
    }
  }
  
  // Update run status
  await supabase
    .from('apify_runs')
    .update({
      finished_at: new Date().toISOString(),
      listings_found: stats.listingsFound,
      listings_new: stats.listingsNew,
      listings_dropped: stats.listingsDropped,
    })
    .eq('id', runId)
  
  console.log('\nSync complete!')
  console.log(`  Found: ${stats.listingsFound}`)
  console.log(`  New: ${stats.listingsNew}`)
  console.log(`  Dropped: ${stats.listingsDropped}`)
  
  return { success: true, stats }
}

const [suburb, postcode, apifyRunId, apifyDatasetId] = process.argv.slice(2)
if (!suburb || !postcode || !apifyRunId || !apifyDatasetId) {
  console.error('Usage: npx tsx sync-apify-run.ts <suburb> <postcode> <apify-run-id> <apify-dataset-id>')
  process.exit(1)
}

syncRun(suburb, postcode, apifyRunId, apifyDatasetId).catch(console.error)
