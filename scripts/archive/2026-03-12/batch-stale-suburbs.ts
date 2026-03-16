#!/usr/bin/env npx tsx
/**
 * Batch DropBear scraper - 10 stale suburbs in one Apify run
 * Rhodes, Ryde, Carlingford, Wentworth Point, St Leonards, Zetland, Waterloo, Wahroonga, Randwick, Rosebery
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
  { name: 'rhodes', postcode: '2138', state: 'nsw' },
  { name: 'ryde', postcode: '2112', state: 'nsw' },
  { name: 'carlingford', postcode: '2118', state: 'nsw' },
  { name: 'wentworth-point', postcode: '2127', state: 'nsw', display: 'wentworth point' },
  { name: 'st-leonards', postcode: '2065', state: 'nsw', display: 'st leonards' },
  { name: 'zetland', postcode: '2017', state: 'nsw' },
  { name: 'waterloo', postcode: '2017', state: 'nsw' },
  { name: 'wahroonga', postcode: '2076', state: 'nsw' },
  { name: 'randwick', postcode: '2031', state: 'nsw' },
  { name: 'rosebery', postcode: '2018', state: 'nsw' },
]

// Known suburb coordinates
const SUBURB_COORDS: Record<string, { lat: number; lng: number }> = {
  'rhodes': { lat: -33.8304, lng: 151.0927 },
  'ryde': { lat: -33.8134, lng: 151.1054 },
  'carlingford': { lat: -33.7719, lng: 151.0490 },
  'wentworth point': { lat: -33.8336, lng: 151.0772 },
  'st leonards': { lat: -33.8250, lng: 151.1947 },
  'zetland': { lat: -33.9122, lng: 151.2070 },
  'waterloo': { lat: -33.8978, lng: 151.2077 },
  'wahroonga': { lat: -33.7167, lng: 151.1167 },
  'randwick': { lat: -33.9235, lng: 151.2411 },
  'rosebery': { lat: -33.9191, lng: 151.2075 },
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

function detectSuburb(url: string, itemSuburb?: string): { suburb: string; postcode: string; display: string } | null {
  // Try to detect from item data first
  if (itemSuburb) {
    const lower = itemSuburb.toLowerCase().replace(/[^a-z]/g, '')
    const found = SUBURBS.find(s => s.name.replace(/[^a-z]/g, '') === lower || (s.display && s.display.replace(/[^a-z]/g, '') === lower))
    if (found) return { suburb: found.name, postcode: found.postcode, display: found.display || found.name }
  }
  
  // Try to detect from URL
  for (const s of SUBURBS) {
    if (url.toLowerCase().includes(s.name)) {
      return { suburb: s.name, postcode: s.postcode, display: s.display || s.name }
    }
  }
  
  return null
}

function getDisplayKey(s: typeof SUBURBS[0]): string {
  return s.display || s.name
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function batchScrape() {
  const startTime = Date.now()
  console.log(`\n=== DropBear Batch Scraper - 10 Stale Suburbs ===`)
  console.log(`Suburbs: ${SUBURBS.map(s => getDisplayKey(s)).join(', ')}`)
  console.log(`Started: ${new Date().toISOString()}`)
  
  // Build URLs - Domain uses hyphenated suburb names
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
        suburb: getDisplayKey(s),
        state: s.state,
        postcode: s.postcode,
        trigger: 'batch-stale',
        apify_run_id: apifyRunId,
        apify_dataset_id: datasetId,
      })
      .select()
      .single()
    
    if (!error && run) {
      runRecords[getDisplayKey(s)] = run
      console.log(`Run ID for ${getDisplayKey(s)}: ${run.id}`)
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
        const key = getDisplayKey(s)
        if (runRecords[key]) {
          await supabase
            .from('apify_runs')
            .update({ finished_at: new Date().toISOString(), error: `Apify ${status}` })
            .eq('id', runRecords[key].id)
        }
      }
      return { success: false, error: `Apify ${status}` }
    }
  }
  
  if (pollTime >= maxPollTime) {
    console.log('Polling timed out')
    for (const s of SUBURBS) {
      const key = getDisplayKey(s)
      if (runRecords[key]) {
        await supabase
          .from('apify_runs')
          .update({ finished_at: new Date().toISOString(), error: 'Polling timeout' })
          .eq('id', runRecords[key].id)
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
    suburbStats[getDisplayKey(s)] = { found: 0, new: 0, dropped: 0, activeIds: [] }
  }
  
  // Process listings
  for (const item of uniqueItems) {
    const listingId = extractListingId(item.url)
    if (!listingId) continue
    
    const detected = detectSuburb(item.url, item.address?.suburb)
    if (!detected) {
      continue
    }
    
    const { suburb, postcode, display } = detected
    suburbStats[display].found++
    suburbStats[display].activeIds.push(listingId)
    
    const price = parsePrice(item.price)
    const itemSuburb = (item.address?.suburb || display).toLowerCase()
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
          suburbStats[display].dropped++
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
        
        suburbStats[display].new++
      }
    }
  }
  
  // Mark inactive listings
  for (const s of SUBURBS) {
    const key = getDisplayKey(s)
    const { data: existingListings } = await supabase
      .from('listings')
      .select('id, listing_id')
      .eq('suburb', key)
      .eq('state', s.state)
      .eq('is_active', true)
    
    if (existingListings) {
      for (const listing of existingListings) {
        if (!suburbStats[key].activeIds.includes(listing.listing_id)) {
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
    const key = getDisplayKey(s)
    if (runRecords[key]) {
      await supabase
        .from('apify_runs')
        .update({
          finished_at: new Date().toISOString(),
          listings_found: suburbStats[key].found,
          listings_new: suburbStats[key].new,
          listings_dropped: suburbStats[key].dropped,
        })
        .eq('id', runRecords[key].id)
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
      const s = SUBURBS.find(x => getDisplayKey(x) === suburb)
      await supabase
        .from('suburbs')
        .insert({
          name: suburb,
          state: 'nsw',
          postcode: s?.postcode || '',
          lat: coords.lat,
          lng: coords.lng,
          is_active: true,
        })
      console.log(`Added coordinates for ${suburb}`)
    } else {
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
