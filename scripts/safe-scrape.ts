#!/usr/bin/env npx tsx
/**
 * Safe DropBear scraper - enforces correct URL format before calling Apify
 * 
 * Usage: npx tsx safe-scrape.ts <suburb-name> <postcode> [state]
 * Example: npx tsx safe-scrape.ts burwood 2134 NSW
 * 
 * This script:
 * 1. Constructs URL with MANDATORY params (ssubs=0, excludeunderoffer=1)
 * 2. Validates the URL
 * 3. Only then calls Apify
 * 
 * This prevents wasting money on incorrect scrapes.
 */

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C'
const APIFY_ACTOR_ID = 'ErD1Yvg2Mvhxo0qCx'

const VALID_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

interface ScrapeConfig {
  suburb: string
  postcode: string
  state: string
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
    errors.push('MISSING: ssubs=0 - will include surrounding suburbs (costs more money!)')
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

async function callApify(url: string, suburb: string): Promise<string> {
  console.log(`\n🚀 Starting Apify run for ${suburb}...`)
  
  const input = {
    searchUrls: [url],
    maxItems: 50000,
    proxyConfiguration: { useApifyProxy: true }
  }
  
  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  )
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify API error: ${res.status} - ${text}`)
  }
  
  const data = await res.json()
  return data.data.id
}

async function main() {
  const args = process.argv.slice(2)
  
  const dryRun = args.includes('--dry-run')
  const filteredArgs = args.filter(a => a !== '--dry-run')
  
  if (filteredArgs.length < 2) {
    console.error('Usage: npx tsx safe-scrape.ts <suburb> <postcode> [state] [--dry-run]')
    console.error('Example: npx tsx safe-scrape.ts burwood 2134 NSW')
    console.error('         npx tsx safe-scrape.ts burwood 2134 --dry-run  (validation only, no Apify call)')
    process.exit(1)
  }
  
  const config: ScrapeConfig = {
    suburb: filteredArgs[0].toLowerCase().trim(),
    postcode: filteredArgs[1].trim(),
    state: (filteredArgs[2] || 'NSW').toUpperCase()
  }
  
  console.log(`\n📍 Suburb: ${config.suburb}`)
  console.log(`📍 Postcode: ${config.postcode}`)
  console.log(`📍 State: ${config.state}`)
  if (dryRun) console.log('📍 Mode: DRY RUN (validation only)')
  
  const inputValidation = validateConfig(config)
  if (!inputValidation.valid) {
    console.error('\n❌ INPUT VALIDATION FAILED:')
    inputValidation.errors.forEach(e => console.error(`   - ${e}`))
    console.error('\n🛑 Aborting to prevent wasted Apify credits')
    process.exit(1)
  }
  
  const url = constructUrl(config)
  console.log(`\n🔗 URL: ${url}`)
  
  const validation = validateUrl(url, config)
  
  if (!validation.valid) {
    console.error('\n❌ URL VALIDATION FAILED:')
    validation.errors.forEach(e => console.error(`   - ${e}`))
    console.error('\n🛑 Aborting to prevent wasted Apify credits')
    process.exit(1)
  }
  
  console.log('\n✅ URL validated:')
  console.log('   - ssubs=0 (excludes surrounding suburbs)')
  console.log('   - excludeunderoffer=1 (excludes under offer)')
  
  if (dryRun) {
    console.log('\n🧪 DRY RUN COMPLETE - no Apify call made')
    console.log('   Run without --dry-run to start actual scrape')
    process.exit(0)
  }
  
  try {
    const runId = await callApify(url, config.suburb)
    console.log(`\n✅ Apify run started: ${runId}`)
    console.log(`📊 Monitor: https://console.apify.com/actors/runs/${runId}`)
    console.log(`\n💡 Next step: npx tsx sync-dataset.ts <run-id-after-completion>`)
  } catch (error) {
    console.error('\n❌ Apify error:', error)
    process.exit(1)
  }
}

main()
