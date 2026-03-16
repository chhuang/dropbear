#!/usr/bin/env npx tsx
/**
 * Batch DropBear scraper - multiple suburbs in one Apify run
 * 
 * Usage: npx tsx batch-scrape.ts
 */

import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
)

// Suburbs to scrape in batch
const SUBURBS = [
  { name: 'hurstville', postcode: '2220', state: 'nsw' },
  { name: 'burwood', postcode: '2134', state: 'nsw' },
  { name: 'haymarket', postcode: '2000', state: 'nsw' },
  { name: 'liverpool', postcode: '2170', state: 'nsw' },
  { name: 'strathfield', postcode: '2135', state: 'nsw' },
]

// Known suburb coordinates (for site rebuild)
const SUBURB_COORDS: Record<string, { lat: number; lng: number }> = {
  'hurstville': { lat: -33.9648, lng: 151.1011 },
  'burwood': { lat: -33.8744, lng: 151.1042 },
  'haymarket': { lat: -33.8794, lng: 151.2041 },
  'liverpool': { lat: -33.9173, lng: 150.9231 },
  'strathfield': { lat: -33.8729, lng: 151.0941 },
}

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

function detectSuburb(url: string, itemSuburb?: string): { suburb: string; postcode: string } | null {
  // Try to detect from item data first
  if (itemSuburb) {
    const lower = itemSuburb.toLowerCase()
    const found = SUBURBS.find(s => s.name === lower)
    if (found) return { suburb: found.name, postcode: found.postcode }
  }
  
  // Try to detect from URL
  for (const s of SUBURBS) {
    if (url.toLowerCase().includes(s.name)) {
      return { suburb: s.name, postcode: s.postcode }
    }
  }
  
  return null
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function batchScrape() {
  const startTime = Date.now()
  console.log(`\n=== DropBear Batch Scraper ===`)
  console.log(`Suburbs: ${SUBURBS.map(s => s.name).join(', ')}`)
  console.log(`Started: ${new Date().toISOString()}`)
  
  // Build URLs
  const searchUrls = SUBURBS.map(s => 
    `https://www.domain.com.au/sale/${s.name}-${s.state}-${s.postcode}/?excludeunderoffer=1&ssubs=0`
  )
  
  console.log(`\nURLs:`)
  searchUrls.forEach(url => console.log(`  ${url}`))
  
  // Start Apify run
  console.log(`\nStarting Apify run...`)
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrls,
        maxItems: 50000,
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
  
  // Create run records for each suburb
  const runRecords: Record<string, any> = {}
  for (const s of SUBURBS) {
    const { data: run, error } = await supabase
      .from('apify_runs')
      .insert({
        suburb: s.name,
        state: s.state,
        postcode: s.postcode,
        trigger: 'batch',
        apify_run_id: apifyRunId,
        apify_dataset_id: datasetId,
      })
      .select()
      .single()
    
    if (!error && run) {
      runRecords[s.name] = run
      console.log(`Run ID for ${s.name}: ${run.id}`)
    }
  }
  
  // Poll for completion (max 30 minutes for batch)
  console.log(`\nPolling for completion...`)
  const maxPollTime = 30 * 60 * 1000
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
      for (const s of SUBURBS) {
        if (runRecords[s.name]) {
          await supabase
            .from('apify_runs')
            .update({ finished_at: new Date().toISOString(), error: `Apify ${status}` })
            .eq('id', runRecords[s.name].id)
        }
      }
      return { success: false, error: `Apify ${status}` }
    }
  }
  
  if (pollTime >= maxPollTime) {
    console.log('Polling timed out')
    for (const s of SUBURBS) {
      if (runRecords[s.name]) {
        await supabase
          .from('apify_runs')
          .update({ finished_at: new Date().toISOString(), error: 'Polling timeout' })
          .eq('id', runRecords[s.name].id)
      }
    }
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
  
  // Group by suburb
  const suburbStats: Record<string, { found: number; new: number; dropped: number; activeIds: number[] }> = {}
  for (const s of SUBURBS) {
    suburbStats[s.name] = { found: 0, new: 0, dropped: 0, activeIds: [] }
  }
  
  // Process listings
  for (const item of uniqueItems) {
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const detected = detectSuburb(item.url, item.address?.suburb)
    if (!detected) {
      // Skip items that don't match our target suburbs
      continue
    }
    
    const { suburb, postcode } = detected
    suburbStats[suburb].found++
    suburbStats[suburb].activeIds.push(listingId)
    
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
          suburbStats[suburb].dropped++
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
          state: 'nsw',
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
        
        suburbStats[suburb].new++
      }
    }
  }
  
  // Mark inactive listings
  for (const s of SUBURBS) {
    const { data: existingListings } = await supabase
      .from('listings')
      .select('id, listing_id')
      .eq('suburb', s.name)
      .eq('state', s.state)
      .eq('is_active', true)
    
    if (existingListings) {
      for (const listing of existingListings) {
        if (!suburbStats[s.name].activeIds.includes(listing.listing_id)) {
          await supabase
            .from('listings')
            .update({ is_active: false })
            .eq('id', listing.id)
        }
      }
    }
  }
  
  // Update run records
  for (const s of SUBURBS) {
    if (runRecords[s.name]) {
      await supabase
        .from('apify_runs')
        .update({
          finished_at: new Date().toISOString(),
          listings_found: suburbStats[s.name].found,
          listings_new: suburbStats[s.name].new,
          listings_dropped: suburbStats[s.name].dropped,
        })
        .eq('id', runRecords[s.name].id)
    }
  }
  
  // Add missing coordinates to suburbs table
  for (const [suburb, coords] of Object.entries(SUBURB_COORDS)) {
    const { data: existing } = await supabase
      .from('suburbs')
      .select('id')
      .eq('name', suburb)
      .single()
    
    if (!existing) {
      await supabase
        .from('suburbs')
        .insert({
          name: suburb,
          state: 'nsw',
          postcode: SUBURBS.find(s => s.name === suburb)?.postcode || '',
          lat: coords.lat,
          lng: coords.lng,
          is_active: true,
        })
      console.log(`Added coordinates for ${suburb}`)
    } else {
      // Update coords if missing
      await supabase
        .from('suburbs')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('name', suburb)
        .is('lat', null)
    }
  }
  
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  
  console.log(`\n=== Batch Sync Complete ===`)
  for (const [suburb, stats] of Object.entries(suburbStats)) {
    console.log(`${suburb}: ${stats.found} found, ${stats.new} new, ${stats.dropped} dropped`)
  }
  console.log(`Elapsed: ${elapsed}s`)
  
  return { success: true, suburbStats, elapsed }
}

batchScrape().catch(console.error)
