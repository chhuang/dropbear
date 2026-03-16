#!/usr/bin/env npx tsx
/**
 * All-in-one DropBear scraper for cron jobs
 * 1. Validates inputs
 * 2. Calls Apify
 * 3. Waits for completion
 * 4. Syncs to DB (including price_history)
 * 5. Checks for new drops
 * 
 * Usage: npx tsx cron-scrape.ts <suburb> <postcode> [state]
 * Example: npx tsx cron-scrape.ts chatswood 2067 NSW
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

async function startApifyRun(url: string): Promise<string> {
  const input = {
    searchUrls: [url],
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
  const maxWait = 120000 // 2 minutes
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWait) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const data = await res.json()
    
    if (data.data.status === 'SUCCEEDED') return data.data.defaultDatasetId
    if (data.data.status === 'FAILED' || data.data.status === 'ABORTED') {
      throw new Error(`Apify run ${data.data.status}: ${data.data.statusMessage}`)
    }
    
    await new Promise(r => setTimeout(r, 5000)) // Wait 5s
  }
  
  throw new Error('Timeout waiting for Apify run')
}

async function fetchDataset(datasetId: string): Promise<any[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`
  )
  return res.json()
}

async function syncToDatabase(suburb: string, items: any[]): Promise<{ new: number; updated: number; drops: any[] }> {
  const { data: existingListings } = await supabase
    .from('listings')
    .select('listing_id, initial_price, current_price')
    .eq('suburb', suburb)
  
  const existingIds = new Set(existingListings?.map(l => l.listing_id) || [])
  const existingPrices = new Map(existingListings?.map(l => [l.listing_id, l.current_price]) || [])
  
  let newCount = 0
  let updateCount = 0
  const drops: any[] = []
  
  for (const item of items) {
    if (!item.url) continue
    
    const listingId = parseInt(item.url.match(/-(\d+)$/)?.[1] || '0')
    if (!listingId) continue
    
    const price = parsePrice(item.price)
    const address = item.address?.value || item.address || ''
    
    if (existingIds.has(listingId)) {
      const oldPrice = existingPrices.get(listingId)
      
      // Update listing
      await supabase
        .from('listings')
        .update({ current_price: price, price_text: item.price, is_active: true })
        .eq('listing_id', listingId)
      
      // Check for drop
      if (oldPrice && price && price < oldPrice) {
        drops.push({ listing_id: listingId, address, old_price: oldPrice, new_price: price })
      }
      
      // Write to price_history
      if (price) {
        await supabase.from('listings_price_history').insert({
          listing_id: listingId,
          price: price,
          price_text: item.price
        })
      }
      
      updateCount++
    } else {
      // Insert new listing
      await supabase.from('listings').insert({
        listing_id: listingId,
        suburb: suburb,
        address: address,
        initial_price: price,
        current_price: price,
        price_text: item.price,
        bedrooms: item.features?.beds,
        bathrooms: item.features?.baths,
        car_spaces: item.features?.parking,
        property_type: item.features?.propertyTypeFormatted?.split('/')[0]?.trim(),
        url: item.url,
        is_active: true
      })
      
      // Write initial price to history
      if (price) {
        await supabase.from('listings_price_history').insert({
          listing_id: listingId,
          price: price,
          price_text: item.price
        })
      }
      
      newCount++
    }
  }
  
  return { new: newCount, updated: updateCount, drops }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('Usage: npx tsx cron-scrape.ts <suburb> <postcode> [state]')
    process.exit(1)
  }
  
  const config: ScrapeConfig = {
    suburb: args[0].toLowerCase().trim(),
    postcode: args[1].trim(),
    state: (args[2] || 'NSW').toUpperCase()
  }
  
  console.log(`\n🐨 DropBear Cron Scrape`)
  console.log(`📍 ${config.suburb} ${config.postcode} ${config.state}`)
  
  // Validate
  const validation = validateConfig(config)
  if (!validation.valid) {
    console.error('\n❌ VALIDATION FAILED:')
    validation.errors.forEach(e => console.error(`   ${e}`))
    process.exit(1)
  }
  
  // Construct URL
  const url = constructUrl(config)
  console.log(`🔗 ${url}`)
  
  try {
    // Start Apify run
    console.log(`\n🚀 Starting Apify run...`)
    const runId = await startApifyRun(url)
    console.log(`📊 Run ID: ${runId}`)
    
    // Wait for completion
    console.log(`⏳ Waiting for completion...`)
    const datasetId = await waitForCompletion(runId)
    console.log(`📦 Dataset: ${datasetId}`)
    
    // Fetch dataset
    console.log(`📥 Fetching ${datasetId}...`)
    const items = await fetchDataset(datasetId)
    console.log(`📋 Found ${items.length} items`)
    
    // Sync to database
    console.log(`\n💾 Syncing to database...`)
    const result = await syncToDatabase(config.suburb, items)
    console.log(`✅ Synced: ${result.new} new, ${result.updated} updated`)
    
    // Check for drops
    if (result.drops.length > 0) {
      console.log(`\n📉 ${result.drops.length} PRICE DROPS DETECTED:`)
      for (const drop of result.drops) {
        const dropAmount = drop.old_price - drop.new_price
        const dropPct = ((dropAmount / drop.old_price) * 100).toFixed(1)
        console.log(`   ${drop.address}: $${drop.old_price?.toLocaleString()} → $${drop.new_price?.toLocaleString()} (-${dropPct}%)`)
      }
    } else {
      console.log(`\n✅ No new price drops detected`)
    }
    
    console.log(`\n✅ Done!`)
    
  } catch (error) {
    console.error(`\n❌ Error:`, error)
    process.exit(1)
  }
}

main()
