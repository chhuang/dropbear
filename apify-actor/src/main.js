/**
 * Domain.com.au Property Scraper - Batch Edition
 * Custom Apify Actor - No rental fees!
 * 
 * Features:
 * - Batch multiple suburbs in one container run
 * - Keep browser alive between suburbs
 * - Retry on HTTP2 errors without restarting container
 * - Delays to avoid rate limiting
 */

import { Actor } from 'apify';
import { Dataset } from 'crawlee';
import { chromium } from 'playwright';

// Initialize Actor
await Actor.init();

// Get input
const input = await Actor.getInput();
const {
  // Single suburb mode (backward compatible)
  suburb,
  postcode,
  state = 'nsw',
  
  // Batch mode
  suburbs = suburb ? [{ suburb, postcode, state }] : [],
  
  // Options
  maxPages = 0,
  excludeUnderOffer = true,
  maxRetries = 5,
  delayBetweenSuburbs = 30000, // 30s
  delayBetweenRetries = 10000, // 10s
} = input || {};

if (suburbs.length === 0) {
  console.log('No suburbs provided. Usage:');
  console.log('  Single: {suburb: "chatswood", postcode: "2067"}');
  console.log('  Batch: {suburbs: [{suburb: "chatswood", postcode: "2067"}, ...]}');
  await Actor.exit();
}

console.log(`\n=== Domain.com.au Batch Scraper ===`);
console.log(`Suburbs to scrape: ${suburbs.length}`);
suburbs.forEach((s, i) => console.log(`  ${i+1}. ${s.suburb}, ${s.state?.toUpperCase() || 'NSW'} ${s.postcode}`));
console.log(`Max retries per suburb: ${maxRetries}`);
console.log(`Delay between suburbs: ${delayBetweenSuburbs}ms`);

// Helper: Parse price text to number
function parsePrice(text) {
  if (!text) return null;
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return null;
  
  const cleaned = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction|For Sale)/i, '').trim();
  
  // $1.5m - $2m (take lower)
  const range = cleaned.match(/\$?([\d,.]+)\s*([mk]?)-/i);
  if (range) {
    let num = parseFloat(range[1].replace(/,/g, ''));
    if (range[2]?.toLowerCase() === 'm') num *= 1000000;
    if (range[2]?.toLowerCase() === 'k') num *= 1000;
    if (num >= 10000) return Math.round(num);
  }
  
  // $1.5m
  const unit = cleaned.match(/\$?([\d,.]+)\s*([mk])/i);
  if (unit) {
    let num = parseFloat(unit[1].replace(/,/g, ''));
    if (unit[2].toLowerCase() === 'm') num *= 1000000;
    if (unit[2].toLowerCase() === 'k') num *= 1000;
    if (num >= 10000) return Math.round(num);
  }
  
  // $1,500,000
  const plain = cleaned.match(/\$([\d,]+)/);
  if (plain) {
    const num = parseFloat(plain[1].replace(/,/g, ''));
    if (num >= 10000) return Math.round(num);
  }
  
  return null;
}

// Launch browser ONCE for all suburbs
console.log('\nLaunching browser...');
const browser = await chromium.launch({
  headless: true,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-AU',
  timezoneId: 'Australia/Sydney',
});

// Create AU residential proxy
const proxyConfig = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
  countryCode: 'AU',
});

const stats = {
  totalSuburbs: suburbs.length,
  succeeded: 0,
  failed: 0,
  totalListings: 0,
  startTime: Date.now(),
};

// Process each suburb
for (let i = 0; i < suburbs.length; i++) {
  const s = suburbs[i];
  const suburbSlug = s.suburb.toLowerCase().replace(/\s+/g, '-');
  const url = `https://www.domain.com.au/sale/${suburbSlug}-${s.state?.toLowerCase() || 'nsw'}-${s.postcode}/?excludeunderoffer=${excludeUnderOffer ? 1 : 0}&ssubs=0`;
  
  console.log(`\n[${i+1}/${suburbs.length}] ${s.suburb} ${s.postcode}`);
  console.log(`  URL: ${url}`);
  
  let listings = [];
  let retries = 0;
  let success = false;
  
  // Retry loop
  while (retries < maxRetries && !success) {
    if (retries > 0) {
      console.log(`  Retry ${retries}/${maxRetries} after ${delayBetweenRetries}ms delay...`);
      await new Promise(r => setTimeout(r, delayBetweenRetries));
    }
    
    try {
      const page = await context.newPage();
      
      // Set realistic headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-AU,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      });
      
      // Navigate with proxy
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      
      // Wait for content
      await page.waitForTimeout(3000);
      
      const title = await page.title();
      console.log(`  Page: ${title}`);
      
      // Check if blocked
      if (title.includes('Access Denied') || title.includes('blocked')) {
        console.log(`  ❌ Blocked by Domain`);
        await page.close();
        retries++;
        continue;
      }
      
      // Extract listings (browser-side for speed)
      listings = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        
        const links = document.querySelectorAll('a[href]');
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const idMatch = href.match(/-(\d{10,})$/);
          if (!idMatch) continue;
          
          const listingId = parseInt(idMatch[1]);
          if (seen.has(listingId)) continue;
          seen.add(listingId);
          
          const card = link.closest('[data-testid*="listing"]') || link.closest('li') || link.closest('article');
          if (!card) continue;
          
          const priceEl = card.querySelector('[data-testid*="price"], [class*="price"], p');
          const addressEl = card.querySelector('[data-testid*="address"], [class*="address"], h2, a');
          const imgEl = card.querySelector('img');
          
          const featureText = card.innerText;
          const bedMatch = featureText.match(/(\d+)\s*Bed/i);
          const bathMatch = featureText.match(/(\d+)\s*Bath/i);
          const carMatch = featureText.match(/(\d+)\s*Car/i);
          
          results.push({
            listing_id: listingId,
            url: href.startsWith('http') ? href : `https://www.domain.com.au${href}`,
            price_text: priceEl?.textContent?.trim() || '',
            address: addressEl?.textContent?.trim() || '',
            bedrooms: bedMatch ? parseInt(bedMatch[1]) : null,
            bathrooms: bathMatch ? parseInt(bathMatch[1]) : null,
            car_spaces: carMatch ? parseInt(carMatch[1]) : null,
            image_url: imgEl?.src || null,
            suburb: s.suburb.toLowerCase(),
            postcode: s.postcode,
            state: (s.state || 'nsw').toUpperCase(),
            property_type: null,
            land_size: null,
            agent_name: null,
            agent_phone: null,
          });
        }
        
        return results;
      });
      
      // Add price parsing
      for (const listing of listings) {
        listing.price = parsePrice(listing.price_text);
      }
      
      console.log(`  ✅ Found ${listings.length} listings`);
      success = true;
      
      // Save to dataset
      if (listings.length > 0) {
        await Dataset.pushData(listings);
        stats.totalListings += listings.length;
      }
      
      await page.close();
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      retries++;
      
      // Check if it's an HTTP2 error (retryable)
      if (error.message.includes('ERR_HTTP2') || error.message.includes('timeout')) {
        console.log(`  Retrying (HTTP2 error is retryable)...`);
      } else {
        // Non-retryable error
        console.log(`  Non-retryable error, skipping suburb`);
        break;
      }
    }
  }
  
  if (success) {
    stats.succeeded++;
  } else {
    stats.failed++;
    console.log(`  ❌ Failed after ${maxRetries} retries`);
  }
  
  // Delay between suburbs (except last one)
  if (i < suburbs.length - 1 && delayBetweenSuburbs > 0) {
    console.log(`  Waiting ${delayBetweenSuburbs/1000}s before next suburb...`);
    await new Promise(r => setTimeout(r, delayBetweenSuburbs));
  }
}

// Cleanup
await browser.close();

// Final stats
const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
console.log(`\n=== Batch Complete ===`);
console.log(`Suburbs: ${stats.succeeded}/${stats.totalSuburbs} succeeded`);
console.log(`Listings: ${stats.totalListings}`);
console.log(`Elapsed: ${elapsed}s`);

// Save stats
await Dataset.pushData({
  stats: {
    totalSuburbs: stats.totalSuburbs,
    succeeded: stats.succeeded,
    failed: stats.failed,
    totalListings: stats.totalListings,
    elapsedSeconds: elapsed,
    scrapedAt: new Date().toISOString(),
  }
});

await Actor.exit();
