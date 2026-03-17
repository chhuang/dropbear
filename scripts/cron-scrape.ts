#!/usr/bin/env npx tsx
/**
 * All-in-one DropBear scraper
 * 1. Validates inputs
 * 2. Calls Apify (supports batch: multiple suburbs in one run)
 * 3. Waits for completion
 * 4. Syncs to DB (including price_history)
 * 5. Records run in apify_runs (one row per suburb)
 * 6. Checks for new drops
 * 
 * Usage:
 *   Single: npx tsx cron-scrape.ts <suburb> <postcode> [state]
 *   Batch:  npx tsx cron-scrape.ts --batch burwood:2134 chatswood:2067 parramatta:2150
 * 
 * Examples:
 *   npx tsx cron-scrape.ts chatswood 2067 NSW
 *   npx tsx cron-scrape.ts --batch burwood:2134 chatswood:2067 manly:2095
 */

import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'
const SUPABASE_URL = 'https://pfmziwdqslxgkyszgdah.supabase.co'
const SUPABASE_KEY = 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'

const VALID_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

interface ScrapeConfig {
  suburb: string
  postcode: string
  state: string
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function validateConfig(config: ScrapeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!config.suburb || !/^[a-zA-Z\s\-]+$/.test(config.suburb)) {
    errors.push(`INVALID suburb: "${config.suburb}"`)
  }
  
  if (!config.postcode || !/^\d{4}$/.test(config.postcode)) {
    errors.push(`INVALID postcode: "${config.postcode}"`)
  }
  
  if (!VALID_STATES.includes(config.state)) {
    errors.push(`INVALID state: "${config.state}"`)
  }
  
  return { valid: errors.length === 0, errors }
}

function constructUrl(config: ScrapeConfig): string {
  const suburbSlug = `${config.suburb.toLowerCase().replace(/\s+/g, '-')}-${config.state.toLowerCase()}-${config.postcode}`
  return `https://www.domain.com.au/sale/${suburbSlug}/?excludeunderoffer=1&ssubs=0`
}

function parsePrice(text: any): number | null {
  if (!text) return null
  if (typeof text === 'number') return text < 10000 ? null : text
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return null
  
  text = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction)/i, '')
  
  const rangeMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)/)
  if (rangeMatch) {
    let num = parseFloat(rangeMatch[1].replace(/,/g, ''))
    const unit = rangeMatch[2]?.toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    return num >= 10000 ? Math.round(num) : null
  }
  
  const unitMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)/i)
  if (unitMatch) {
    let num = parseFloat(unitMatch[1].replace(/,/g, ''))
    const unit = unitMatch[2].toLowerCase()
    if (unit === 'm' || unit === 'million') num *= 1000000
    if (unit === 'k' || unit === 'thousand') num *= 1000
    return num >= 10000 ? Math.round(num) : null
  }
  
  const plainMatch = text.match(/\$([\d,]+)/)
  if (plainMatch) {
    const num = parseFloat(plainMatch[1].replace(/,/g, ''))
    return num >= 10000 ? num : null
  }
  
  return null
}

function extractSuburbFromItem(item: any): string | null {
  // Try to extract suburb from the item
  // Domain items may have suburb in different fields
  if (item.suburb) return item.suburb.toLowerCase()
  if (item.address?.suburb) return item.address.suburb.toLowerCase()
  
  // Fallback: extract from URL path
  const urlMatch = item.url?.match(/\/sale\/([a-z\-]+)-[a-z]{2,3}-\d+/i)
  if (urlMatch) return urlMatch[1].replace(/-/g, ' ')
  
  return null
}

async function startApifyRun(urls: string[]): Promise<string> {
  const input = {
    searchUrls: urls,
    maxItems: 50000,
    proxyConfiguration: { useApifyProxy: true }
  }
  
  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  )
  
  if (!res.ok) throw new Error(`Apify API error: ${res.status}`)
  const data = await res.json()
  return data.data.id
}

async function waitForCompletion(runId: string): Promise<string> {
  const maxWait = 180000 // 3 minutes
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWait) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const data = await res.json()
    
    if (data.data.status === 'SUCCEEDED') return data.data.defaultDatasetId
    if (data.data.status === 'FAILED' || data.data.status === 'ABORTED') {
      throw new Error(`Apify run ${data.data.status}: ${data.data.statusMessage}`)
    }
    
    await new Promise(r => setTimeout(r, 5000))
  }
  
  throw new Error('Timeout waiting for Apify run')
}

async function fetchDataset(datasetId: string): Promise<any[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
  )
  return res.json()
}

async function syncToDatabase(
  items: any[],
  configs: ScrapeConfig[]
): Promise<Map<string, { new: number; updated: number; drops: any[] }>> {
  const results = new Map<string, { new: number; updated: number; drops: any[] }>()
  
  // Build suburb -> config mapping
  const suburbConfig = new Map(configs.map(c => [c.suburb.toLowerCase(), c]))
  
  // Get all existing listings for these suburbs
  const suburbs = configs.map(c => c.suburb.toLowerCase())
  const { data: existingListings } = await supabase
    .from('listings')
    .select('listing_id, suburb, initial_price, current_price')
    .in('suburb', suburbs)
  
  const existingMap = new Map<string, { initial_price: number | null; current_price: number | null }>()
  for (const l of existingListings || []) {
    existingMap.set(`${l.suburb}:${l.listing_id}`, {
      initial_price: l.initial_price,
      current_price: l.current_price
    })
  }
  
  // Track which listings we see in this scrape
  const seenListings = new Set<string>()
  
  // Process items
  for (const item of items) {
    if (!item.url) continue
    
    const listingId = parseInt(item.url.match(/-(\d+)$/)?.[1] || '0')
    if (!listingId) continue
    
    const itemSuburb = extractSuburbFromItem(item)
    if (!itemSuburb || !suburbConfig.has(itemSuburb)) continue
    
    const config = suburbConfig.get(itemSuburb)!
    const price = parsePrice(item.price)
    const address = item.address?.value || item.address || ''
    const key = `${itemSuburb}:${listingId}`
    
    seenListings.add(key)
    
    if (existingMap.has(key)) {
      const existing = existingMap.get(key)!
      
      // Update listing
      await supabase
        .from('listings')
        .update({ 
          current_price: price, 
          price_text: item.price,
          last_seen_at: new Date().toISOString()
        })
        .eq('listing_id', listingId)
      
      // Check for drop
      if (existing.initial_price && price && price < existing.initial_price) {
        const drops = results.get(itemSuburb)?.drops || []
        drops.push({
          listing_id: listingId,
          address,
          old_price: existing.initial_price,
          new_price: price
        })
        results.set(itemSuburb, {
          ...results.get(itemSuburb) || { new: 0, updated: 0, drops: [] },
          drops
        })
      }
      
      // Write to price_history
      if (price !== null) {
        await supabase.from('listings_price_history').insert({
          listing_id: listingId,
          price,
          price_text: item.price
        })
      }
      
      const curr = results.get(itemSuburb) || { new: 0, updated: 0, drops: [] }
      results.set(itemSuburb, { ...curr, updated: curr.updated + 1 })
    } else {
      // Insert new listing
      await supabase.from('listings').insert({
        listing_id: listingId,
        suburb: itemSuburb,
        address,
        initial_price: price,
        current_price: price,
        price_text: item.price,
        bedrooms: item.features?.beds,
        bathrooms: item.features?.baths,
        car_spaces: item.features?.parking,
        property_type: item.features?.propertyTypeFormatted?.split('/')[0]?.trim(),
        url: item.url,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      })
      
      // Write to price_history
      if (price !== null) {
        await supabase.from('listings_price_history').insert({
          listing_id: listingId,
          price,
          price_text: item.price
        })
      }
      
      const curr = results.get(itemSuburb) || { new: 0, updated: 0, drops: [] }
      results.set(itemSuburb, { ...curr, new: curr.new + 1 })
    }
  }
  
  // Mark listings not seen as stale (update last_seen_at to old value, we don't delete)
  // We could track "active" by comparing last_seen_at to scrape time, but for now just leave them
  
  return results
}

async function recordRun(
  apifyRunId: string,
  datasetId: string,
  configs: ScrapeConfig[],
  results: Map<string, { new: number; updated: number; drops: any[] }>,
  itemsCount: number
) {
  for (const config of configs) {
    const result = results.get(config.suburb.toLowerCase()) || { new: 0, updated: 0, drops: [] }
    
    await supabase.from('apify_runs').insert({
      apify_run_id: apifyRunId,
      suburb: config.suburb.toLowerCase(),
      postcode: config.postcode,
      dataset_id: datasetId,
      finished_at: new Date().toISOString(),
      status: 'completed',
      listings_found: result.new + result.updated,
      listings_new: result.new
    })
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  let configs: ScrapeConfig[] = []
  
  if (args[0] === '--batch') {
    // Batch mode: --batch burwood:2134 chatswood:2067
    for (const arg of args.slice(1)) {
      const [suburb, postcode, state = 'NSW'] = arg.split(':')
      configs.push({
        suburb: suburb.toLowerCase().trim(),
        postcode: postcode.trim(),
        state: state.toUpperCase()
      })
    }
  } else {
    // Single mode: burwood 2134 NSW
    if (args.length < 2) {
      console.error('Usage:')
      console.error('  Single: npx tsx cron-scrape.ts <suburb> <postcode> [state]')
      console.error('  Batch:  npx tsx cron-scrape.ts --batch burwood:2134 chatswood:2067')
      process.exit(1)
    }
    
    configs.push({
      suburb: args[0].toLowerCase().trim(),
      postcode: args[1].trim(),
      state: (args[2] || 'NSW').toUpperCase()
    })
  }
  
  console.log(`\n🐨 DropBear Scrape`)
  console.log(`📍 ${configs.length} suburb(s): ${configs.map(c => `${c.suburb} ${c.postcode}`).join(', ')}`)
  
  // Validate all
  for (const config of configs) {
    const validation = validateConfig(config)
    if (!validation.valid) {
      console.error(`\n❌ VALIDATION FAILED for ${config.suburb}:`)
      validation.errors.forEach(e => console.error(`   ${e}`))
      process.exit(1)
    }
  }
  
  // Construct URLs
  const urls = configs.map(c => constructUrl(c))
  urls.forEach((url, i) => console.log(`🔗 [${i + 1}] ${url}`))
  
  try {
    // Start Apify run
    console.log(`\n🚀 Starting Apify run (${configs.length} suburbs in one batch)...`)
    const runId = await startApifyRun(urls)
    console.log(`📊 Run ID: ${runId}`)
    
    // Wait for completion
    console.log(`⏳ Waiting for completion...`)
    const datasetId = await waitForCompletion(runId)
    console.log(`📦 Dataset: ${datasetId}`)
    
    // Fetch dataset
    console.log(`📥 Fetching ${datasetId}...`)
    const items = await fetchDataset(datasetId)
    console.log(`📋 Found ${items.length} items total`)
    
    // Sync to database
    console.log(`\n💾 Syncing to database...`)
    const results = await syncToDatabase(items, configs)
    
    // Print results per suburb
    for (const config of configs) {
      const result = results.get(config.suburb.toLowerCase()) || { new: 0, updated: 0, drops: [] }
      console.log(`   ${config.suburb}: ${result.new} new, ${result.updated} updated`)
      
      if (result.drops.length > 0) {
        console.log(`   📉 ${result.drops.length} DROPS in ${config.suburb}:`)
        for (const drop of result.drops) {
          const dropAmount = drop.old_price - drop.new_price
          const dropPct = ((dropAmount / drop.old_price) * 100).toFixed(1)
          console.log(`      ${drop.address}: $${drop.old_price?.toLocaleString()} → $${drop.new_price?.toLocaleString()} (-${dropPct}%)`)
        }
      }
    }
    
    // Record runs
    await recordRun(runId, datasetId, configs, results, items.length)
    
    console.log(`\n✅ Done! Run ID: ${runId}`)
    
  } catch (error) {
    console.error(`\n❌ Error:`, error)
    process.exit(1)
  }
}

main()
