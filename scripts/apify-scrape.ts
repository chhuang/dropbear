#!/usr/bin/env npx tsx
/**
 * DropBear Apify scraper
 * 
 * Usage:
 *   Dry run (validation only):  npx tsx apify-scrape.ts --dry-run burwood
 *   Single suburb:              npx tsx apify-scrape.ts burwood
 *   Multiple (batch):           npx tsx apify-scrape.ts burwood chatswood epping
 *   Explicit postcode:          npx tsx apify-scrape.ts richmond:2753
 *   Other state:                npx tsx apify-scrape.ts southbank:3006:VIC
 * 
 * Format: suburb[:postcode[:state]]
 *   - Looks up postcode from suburbs table if not provided
 *   - Multiple suburbs = batch mode (one Apify run, saves money)
 * 
 * What it does:
 *   1. Validates inputs (looks up from DB if needed)
 *   2. Constructs Domain URLs (ssubs=0, excludeunderoffer=1)
 *   3. Calls Apify EasyApi
 *   4. Waits for completion
 *   5. Syncs to Supabase (listings + price_history)
 *   6. Records run per suburb
 *   7. Detects price drops
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

async function lookupSuburb(name: string): Promise<{ postcode: string; state: string } | null> {
  const { data, error } = await supabase
    .from('suburbs')
    .select('postcode, state')
    .ilike('name', name.toLowerCase())
    .limit(1)
    .single()
  
  if (error || !data) return null
  
  return {
    postcode: data.postcode,
    state: data.state.toUpperCase()
  }
}

async function parseArg(arg: string): Promise<ScrapeConfig> {
  const parts = arg.split(':')
  
  if (parts.length === 1) {
    // Just suburb name - lookup from DB
    const suburb = parts[0].toLowerCase().trim()
    const lookup = await lookupSuburb(suburb)
    
    if (!lookup) {
      throw new Error(`Suburb "${suburb}" not found in database. Use format: ${suburb}:<postcode>[:state]`)
    }
    
    return {
      suburb,
      postcode: lookup.postcode,
      state: lookup.state
    }
  }
  
  if (parts.length >= 2) {
    // Explicit format: suburb:postcode[:state]
    return {
      suburb: parts[0].toLowerCase().trim(),
      postcode: parts[1].trim(),
      state: (parts[2] || 'NSW').toUpperCase()
    }
  }
  
  throw new Error(`Invalid format "${arg}" - expected suburb[:postcode[:state]]`)
}

function validateConfig(config: ScrapeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!config.suburb || !/^[a-zA-Z\s\-]+$/.test(config.suburb)) {
    errors.push(`INVALID suburb: "${config.suburb}" - must contain only letters, spaces, hyphens`)
  }
  
  if (!config.postcode || !/^\d{4}$/.test(config.postcode)) {
    errors.push(`INVALID postcode: "${config.postcode}" - must be 4 digits`)
  }
  
  if (!VALID_STATES.includes(config.state)) {
    errors.push(`INVALID state: "${config.state}" - must be one of: ${VALID_STATES.join(', ')}`)
  }
  
  return { valid: errors.length === 0, errors }
}

function constructUrl(config: ScrapeConfig): string {
  const suburbSlug = `${config.suburb.toLowerCase().replace(/\s+/g, '-')}-${config.state.toLowerCase()}-${config.postcode}`
  const params = new URLSearchParams({
    excludeunderoffer: '1',
    ssubs: '0'
  })
  return `https://www.domain.com.au/sale/${suburbSlug}/?${params.toString()}`
}

function validateUrl(url: string, config: ScrapeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!url.includes('ssubs=0')) {
    errors.push('MISSING: ssubs=0 - will include surrounding suburbs (wastes money!)')
  }
  
  if (!url.includes('excludeunderoffer=1')) {
    errors.push('MISSING: excludeunderoffer=1 - will include properties under offer')
  }
  
  if (!url.includes(config.postcode)) {
    errors.push(`MISSING: postcode ${config.postcode} in URL`)
  }
  
  if (!url.match(/domain\.com\.au\/sale\//)) {
    errors.push('INVALID: not a valid Domain.com.au sale URL')
  }
  
  return { valid: errors.length === 0, errors }
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
  if (item.suburb) return item.suburb.toLowerCase()
  if (item.address?.suburb) return item.address.suburb.toLowerCase()
  
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
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify API error: ${res.status} - ${text}`)
  }
  
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
  
  const suburbConfig = new Map(configs.map(c => [c.suburb.toLowerCase(), c]))
  
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
    
    if (existingMap.has(key)) {
      const existing = existingMap.get(key)!
      
      await supabase
        .from('listings')
        .update({ 
          current_price: price, 
          price_text: item.price,
          last_seen_at: new Date().toISOString()
        })
        .eq('listing_id', listingId)
      
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
      apify_dataset_id: datasetId,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      trigger: 'manual',
      listings_found: result.new + result.updated,
      listings_new: result.new
    })
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  const dryRun = args.includes('--dry-run')
  const suburbArgs = args.filter(a => a !== '--dry-run' && !a.startsWith('-'))
  
  if (suburbArgs.length === 0) {
    console.error('Usage:')
    console.error('  Dry run:  npx tsx apify-scrape.ts --dry-run burwood')
    console.error('  Single:   npx tsx apify-scrape.ts burwood')
    console.error('  Multiple: npx tsx apify-scrape.ts burwood chatswood epping')
    console.error('  Explicit: npx tsx apify-scrape.ts richmond:2753')
    console.error('  Other state: npx tsx apify-scrape.ts southbank:3006:VIC')
    console.error('')
    console.error('Format: suburb[:postcode[:state]]')
    console.error('  - Looks up postcode from suburbs table if not provided')
    process.exit(1)
  }
  
  // Parse all suburb args
  const configs: ScrapeConfig[] = []
  for (const arg of suburbArgs) {
    try {
      const config = await parseArg(arg)
      configs.push(config)
    } catch (e) {
      console.error(`\n❌ ${e}`)
      process.exit(1)
    }
  }
  
  console.log(`\n🐨 DropBear Scraper`)
  console.log(`📍 ${configs.length} suburb${configs.length > 1 ? 's' : ''}: ${configs.map(c => `${c.suburb} ${c.postcode}`).join(', ')}`)
  if (dryRun) console.log('🧪 DRY RUN MODE - validation only, no Apify call')
  
  // Validate all configs
  for (const config of configs) {
    const validation = validateConfig(config)
    if (!validation.valid) {
      console.error(`\n❌ VALIDATION FAILED for ${config.suburb}:`)
      validation.errors.forEach(e => console.error(`   - ${e}`))
      process.exit(1)
    }
  }
  
  // Construct and validate URLs
  const urls = configs.map(c => constructUrl(c))
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]
    const url = urls[i]
    const urlValidation = validateUrl(url, config)
    
    if (!urlValidation.valid) {
      console.error(`\n❌ URL VALIDATION FAILED for ${config.suburb}:`)
      urlValidation.errors.forEach(e => console.error(`   - ${e}`))
      console.error('\n🛑 Aborting to prevent wasted Apify credits')
      process.exit(1)
    }
    
    console.log(`\n🔗 [${i + 1}] ${url}`)
    console.log('   ✅ ssubs=0 (excludes surrounding suburbs)')
    console.log('   ✅ excludeunderoffer=1 (excludes under offer)')
  }
  
  if (dryRun) {
    console.log('\n🧪 DRY RUN COMPLETE - no Apify call made')
    console.log('   Run without --dry-run to start actual scrape')
    process.exit(0)
  }
  
  try {
    // Start Apify run
    console.log(`\n🚀 Starting Apify run (${configs.length} suburb${configs.length > 1 ? 's' : ''})...`)
    const runId = await startApifyRun(urls)
    console.log(`📊 Run ID: ${runId}`)
    console.log(`📈 Monitor: https://console.apify.com/actors/runs/${runId}`)
    
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
