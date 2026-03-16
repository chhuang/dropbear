#!/usr/bin/env npx tsx
/**
 * Cron-ready DropBear scraper
 * 1. Starts Apify run for a suburb
 * 2. Polls for completion
 * 3. Syncs dataset to Supabase
 * 
 * Usage: npx tsx cron-scrape.ts <suburb> <postcode> [--state=NSW]
 */

import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
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
  
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return undefined
  
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction\s*-\s*guide|For Sale\s*\|\s*)/i, '')
  
  const rangeWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?/i)
  if (rangeWithUnitMatch) {
    let num = parseFloat(rangeWithUnitMatch[1].replace(/,/g, ''))
    const unit = rangeWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  const singleWithUnitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)\b/i)
  if (singleWithUnitMatch) {
    let num = parseFloat(singleWithUnitMatch[1].replace(/,/g, ''))
    const unit = singleWithUnitMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    if (num >= 10000) return Math.round(num)
  }
  
  const plainMatch = text.match(/\$([\d,]+(?:\.\d+)?)/)
  if (plainMatch) {
    let num = parseFloat(plainMatch[1].replace(/,/g, ''))
    if (num >= 10000) return Math.round(num)
  }
  
  return undefined
}

function extractAgentPhone(text: any): string | undefined {
  if (!text || typeof text !== 'string') return undefined
  const match = text.match(/04\d{2}[\s]?\d{3}[\s]?\d{3}/)
  return match ? match[0].replace(/\s/g, '') : undefined
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function cronScrape(suburb: string, postcode: string, state: string = 'nsw') {
  const startTime = Date.now()
  console.log(`\n=== DropBear Scraper ===`)
  console.log(`Suburb: ${suburb}, ${state.toUpperCase()} ${postcode}`)
  console.log(`Started: ${new Date().toISOString()}`)
  
  // Check for running job
  const { data: runningJobs } = await supabase
    .from('apify_runs')
    .select('id, apify_run_id, started_at')
    .eq('suburb', suburb.toLowerCase())
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
  
  if (runningJobs && runningJobs.length > 0) {
    const job = runningJobs[0]
    const age = Date.now() - new Date(job.started_at).getTime()
    
    // If job is less than 1 hour old, skip
    if (age < 3600000) {
      console.log(`\nSkipping: job ${job.id} already running (${Math.round(age/60000)}min ago)`)
      return { success: false, reason: 'job_running' }
    }
    
    // Old stuck job, mark as failed
    console.log(`\nMarking stuck job ${job.id} as failed`)
    await supabase
      .from('apify_runs')
      .update({ finished_at: new Date().toISOString(), error: 'Timed out' })
      .eq('id', job.id)
  }
  
  // Build URL
  const url = `https://www.domain.com.au/sale/${suburb.toLowerCase()}-${state.toLowerCase()}-${postcode}/?excludeunderoffer=1&ssubs=0`
  console.log(`\nStarting Apify run...`)
  console.log(`URL: ${url}`)
  
  // Start Apify run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrls: [url],
        maxItems: 10000,
        proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: [] },
        maxConcurrency: 1,
      }),
    }
  )
  
  if (!startRes.ok) {
    const err = await startRes.text()
    console.error(`Failed to start Apify: ${err}`)
    return { success: false, error: err }
  }
  
  const startData = await startRes.json()
  const apifyRunId = startData.data.id
  const datasetId = startData.data.defaultDatasetId
  
  console.log(`Apify run: ${apifyRunId}`)
  console.log(`Dataset: ${datasetId}`)
  
  // Create run record
  const { data: run, error: runError } = await supabase
    .from('apify_runs')
    .insert({
      suburb: suburb.toLowerCase(),
      state: state.toLowerCase(),
      postcode,
      trigger: 'cron',
      apify_run_id: apifyRunId,
      apify_dataset_id: datasetId,
    })
    .select()
    .single()
  
  if (runError || !run) {
    console.error('Failed to create run record:', runError)
    return { success: false, error: 'Failed to create run record' }
  }
  
  console.log(`Run ID: ${run.id}`)
  
  // Poll for completion (max 15 minutes)
  console.log(`\nPolling for completion...`)
  const maxPollTime = 15 * 60 * 1000
  const pollInterval = 30000
  let pollTime = 0
  
  while (pollTime < maxPollTime) {
    await sleep(pollInterval)
    pollTime += pollInterval
    
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs/${apifyRunId}?token=${APIFY_TOKEN}`
    )
    
    if (!statusRes.ok) {
      console.log(`  Poll error: ${statusRes.status}`)
      continue
    }
    
    const statusData = await statusRes.json()
    const status = statusData.data.status
    console.log(`  [${Math.round(pollTime/1000)}s] Status: ${status}`)
    
    if (status === 'SUCCEEDED') {
      break
    } else if (status === 'FAILED' || status === 'ABORTED') {
      await supabase
        .from('apify_runs')
        .update({ finished_at: new Date().toISOString(), error: `Apify ${status}` })
        .eq('id', run.id)
      
      return { success: false, error: `Apify ${status}` }
    }
  }
  
  if (pollTime >= maxPollTime) {
    console.log('Polling timed out')
    await supabase
      .from('apify_runs')
      .update({ finished_at: new Date().toISOString(), error: 'Polling timeout' })
      .eq('id', run.id)
    
    return { success: false, error: 'Polling timeout' }
  }
  
  // Fetch dataset
  console.log(`\nFetching dataset...`)
  const items = []
  let offset = 0
  const limit = 1000
  let hasMore = true
  
  while (hasMore) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&offset=${offset}&limit=${limit}&clean=true`
    )
    
    if (!res.ok) {
      console.error(`Failed to fetch dataset: ${res.status}`)
      await supabase
        .from('apify_runs')
        .update({ finished_at: new Date().toISOString(), error: `Dataset fetch failed: ${res.status}` })
        .eq('id', run.id)
      
      return { success: false, error: `Dataset fetch failed: ${res.status}` }
    }
    
    const data = await res.json()
    items.push(...data)
    
    console.log(`  Fetched ${items.length} items...`)
    hasMore = data.length === limit
    offset += limit
  }
  
  console.log(`Total items: ${items.length}`)
  
  // Deduplicate
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
    const itemSuburb = (item.address?.suburb || suburb).toLowerCase()
    const itemPostcode = item.address?.postcode || postcode
    
    const { data: existing } = await supabase
      .from('listings')
      .select('*')
      .eq('listing_id', listingId)
      .single()
    
    if (existing) {
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
      const { data: newListing, error } = await supabase
        .from('listings')
        .insert({
          listing_id: listingId,
          url: item.url,
          source: 'domain.com.au',
          suburb: itemSuburb,
          state: state.toLowerCase(),
          postcode: itemPostcode,
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
  
  // Mark inactive
  const { data: existingListings } = await supabase
    .from('listings')
    .select('id, listing_id')
    .eq('suburb', suburb.toLowerCase())
    .eq('state', state.toLowerCase())
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
  
  // Update run
  await supabase
    .from('apify_runs')
    .update({
      finished_at: new Date().toISOString(),
      listings_found: stats.listingsFound,
      listings_new: stats.listingsNew,
      listings_dropped: stats.listingsDropped,
    })
    .eq('id', run.id)
  
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  
  console.log(`\n=== Sync Complete ===`)
  console.log(`Found: ${stats.listingsFound}`)
  console.log(`New: ${stats.listingsNew}`)
  console.log(`Dropped: ${stats.listingsDropped}`)
  console.log(`Elapsed: ${elapsed}s`)
  
  return { success: true, stats, elapsed }
}

// Parse args
const args = process.argv.slice(2)
const suburb = args[0]
const postcode = args[1]
const stateArg = args.find(a => a.startsWith('--state='))
const state = stateArg ? stateArg.split('=')[1] : 'nsw'

if (!suburb || !postcode) {
  console.error('Usage: npx tsx cron-scrape.ts <suburb> <postcode> [--state=NSW]')
  process.exit(1)
}

cronScrape(suburb, postcode, state).catch(console.error)
