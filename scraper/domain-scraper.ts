#!/usr/bin/env npx tsx
/**
 * DIY Domain.com.au scraper
 * Runs on rook, no Apify rental needed
 * 
 * Usage: npx tsx domain-scraper.ts <suburb> <postcode> [--proxy=url]
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../web/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C';

interface Listing {
  listing_id: number;
  url: string;
  title: string;
  suburb: string;
  postcode: string;
  state: string;
  price: number | null;
  price_text: string;
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  car_spaces: number | null;
  property_type: string | null;
  land_size: number | null;
  agent_name: string | null;
  agent_phone: string | null;
  image_url: string | null;
}

function extractListingId(url: string): number {
  const match = url.match(/-(\d+)$/);
  return match ? parseInt(match[1]) : 0;
}

function parsePrice(text: string | null): number | null {
  if (!text) return null;
  
  // Skip phone numbers
  if (/04\d{8}/.test(text.replace(/\s/g, ''))) return null;
  
  // Skip low values
  const cleaned = text.replace(/^(Guide|From|Offers|Under|Over|Around|About|Auction\s*-\s*guide|For Sale\s*\|\s*)/i, '');
  
  // Range with unit: $1.2m - $1.5m
  const rangeWithUnit = cleaned.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?\s*[-–to]+\s*\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)?/i);
  if (rangeWithUnit) {
    let num = parseFloat(rangeWithUnit[1].replace(/,/g, ''));
    const unit = rangeWithUnit[2]?.toLowerCase();
    if (unit === 'm' || unit === 'million') num *= 1000000;
    if (unit === 'k' || unit === 'thousand') num *= 1000;
    if (num >= 10000) return Math.round(num);
  }
  
  // Single with unit: $1.5m
  const singleWithUnit = cleaned.match(/\$?([\d,]+(?:\.\d+)?)\s*([mkMK]|million|thousand)\b/i);
  if (singleWithUnit) {
    let num = parseFloat(singleWithUnit[1].replace(/,/g, ''));
    const unit = singleWithUnit[2]?.toLowerCase();
    if (unit === 'm' || unit === 'million') num *= 1000000;
    if (unit === 'k' || unit === 'thousand') num *= 1000;
    if (num >= 10000) return Math.round(num);
  }
  
  // Plain dollar: $1,200,000
  const plainMatch = cleaned.match(/\$([\d,]+(?:\.\d+)?)/);
  if (plainMatch) {
    const num = parseFloat(plainMatch[1].replace(/,/g, ''));
    if (num >= 10000) return Math.round(num);
  }
  
  return null;
}

function extractPhone(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/04\d{2}[\s]?\d{3}[\s]?\d{3}/);
  return match ? match[0].replace(/\s/g, '') : null;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeSuburb(
  browser: Browser,
  suburb: string,
  postcode: string,
  state: string = 'nsw'
): Promise<Listing[]> {
  const listings: Listing[] = [];
  const page = await browser.newPage();
  
  // Set user agent to look more like a real browser
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-AU,en;q=0.9',
  });
  
  const url = `https://www.domain.com.au/sale/${suburb.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}-${postcode}/?excludeunderoffer=1&ssubs=0`;
  
  console.log(`  URL: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Wait for listings to load
    await page.waitForSelector('[data-testid="listing-card-wrapper"], li.css-1d6czz7', { timeout: 30000 });
    
    // Get total results
    const resultsText = await page.locator('h1, .css-ek9mkp').first().textContent().catch(() => '');
    const totalMatch = resultsText?.match(/(\d+,?\d*)\s*(?:properties|results|listings)/i);
    const total = totalMatch ? parseInt(totalMatch[1].replace(',', '')) : 0;
    console.log(`  Found ~${total} properties`);
    
    // Scroll to load more (Domain lazy loads)
    let previousHeight = 0;
    let attempts = 0;
    while (attempts < 5) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);
      
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;
      attempts++;
    }
    
    // Extract listings
    const cards = await page.locator('[data-testid="listing-card-wrapper"], li.css-1d6czz7').all();
    console.log(`  Scraping ${cards.length} cards...`);
    
    for (const card of cards) {
      try {
        const link = await card.locator('a').first().getAttribute('href').catch(() => null);
        if (!link) continue;
        
        const fullUrl = link.startsWith('http') ? link : `https://www.domain.com.au${link}`;
        const listingId = extractListingId(fullUrl);
        if (!listingId) continue;
        
        const priceText = await card.locator('[data-testid="listing-card-price"], p.css-1h81j5p').first().textContent().catch(() => '');
        const title = await card.locator('h2, [data-testid="listing-card-title"]').first().textContent().catch(() => '');
        const address = await card.locator('[data-testid="listing-card-address"], span.css-1k4pmbi').first().textContent().catch(() => '');
        
        // Features (beds, baths, cars)
        const features = await card.locator('[data-testid="listing-card-features"] span, li.css-1c5gl6n span').allTextContents().catch(() => []);
        let bedrooms: number | null = null;
        let bathrooms: number | null = null;
        let carSpaces: number | null = null;
        
        for (const f of features) {
          if (f.includes('Bed')) bedrooms = parseInt(f) || null;
          if (f.includes('Bath')) bathrooms = parseInt(f) || null;
          if (f.includes('Car')) carSpaces = parseInt(f) || null;
        }
        
        // Image
        const imageUrl = await card.locator('img').first().getAttribute('src').catch(() => null);
        
        listings.push({
          listing_id: listingId,
          url: fullUrl,
          title: title.trim(),
          suburb: suburb.toLowerCase(),
          postcode,
          state: state.toUpperCase(),
          price: parsePrice(priceText),
          price_text: priceText?.trim() || '',
          address: address?.trim() || '',
          bedrooms,
          bathrooms,
          car_spaces: carSpaces,
          property_type: null,
          land_size: null,
          agent_name: null,
          agent_phone: null,
          image_url: imageUrl,
        });
        
      } catch (e) {
        // Skip problematic cards
      }
    }
    
  } catch (error: any) {
    console.error(`  Error: ${error.message}`);
  } finally {
    await page.close();
  }
  
  return listings;
}

async function syncToSupabase(listings: Listing[], suburb: string) {
  let newCount = 0;
  let updateCount = 0;
  
  for (const listing of listings) {
    // Check if exists
    const { data: existing } = await supabase
      .from('listings')
      .select('id, current_price')
      .eq('listing_id', listing.listing_id)
      .single();
    
    if (existing) {
      // Update if price changed
      if (listing.price && existing.current_price !== listing.price) {
        await supabase
          .from('listings')
          .update({
            current_price: listing.price,
            price_text: listing.price_text,
            updated_at: new Date().toISOString(),
          })
          .eq('listing_id', listing.listing_id);
        updateCount++;
      }
    } else {
      // Insert new
      await supabase.from('listings').insert({
        listing_id: listing.listing_id,
        url: listing.url,
        title: listing.title,
        suburb: listing.suburb,
        postcode: listing.postcode,
        state: listing.state,
        initial_price: listing.price,
        current_price: listing.price,
        price_text: listing.price_text,
        address: listing.address,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        car_spaces: listing.car_spaces,
        property_type: listing.property_type,
        land_size: listing.land_size,
        agent_name: listing.agent_name,
        agent_phone: listing.agent_phone,
        image_url: listing.image_url,
      });
      newCount++;
    }
  }
  
  return { newCount, updateCount };
}

// Try multiple free proxy sources
const FREE_PROXIES = [
  // Will be populated dynamically
];

async function getFreeProxy(): Promise<string | null> {
  try {
    const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=AU');
    const text = await res.text();
    const proxies = text.trim().split('\n').filter(p => p.includes(':'));
    if (proxies.length > 0) {
      return `http://${proxies[Math.floor(Math.random() * proxies.length)]}`;
    }
  } catch {}
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const suburb = args[0];
  const postcode = args[1];
  const proxyUrl = args.find(a => a.startsWith('--proxy='))?.split('=')[1];
  const useFreeProxy = args.includes('--free-proxy');
  
  if (!suburb || !postcode) {
    console.log('Usage: npx tsx domain-scraper.ts <suburb> <postcode> [--proxy=url] [--free-proxy]');
    process.exit(1);
  }
  
  const startTime = Date.now();
  console.log(`\n=== DIY Domain Scraper ===`);
  console.log(`Suburb: ${suburb}, NSW ${postcode}`);
  console.log(`Started: ${new Date().toISOString()}`);
  
  let finalProxy = proxyUrl;
  if (useFreeProxy && !proxyUrl) {
    console.log('Fetching free proxy...');
    finalProxy = await getFreeProxy();
    if (finalProxy) {
      console.log(`Got proxy: ${finalProxy}`);
    } else {
      console.log('No free proxy available, trying without...');
    }
  }
  
  if (finalProxy) console.log(`Proxy: ${finalProxy}`);
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    proxy: finalProxy ? { server: finalProxy } : undefined,
  });
  
  try {
    const listings = await scrapeSuburb(browser, suburb, postcode);
    console.log(`\n  Total items: ${listings.length}`);
    console.log(`  Unique listings: ${listings.filter(l => l.listing_id).length}`);
    
    if (listings.length > 0) {
      console.log(`\nSyncing to Supabase...`);
      const { newCount, updateCount } = await syncToSupabase(listings, suburb);
      console.log(`  New: ${newCount}`);
      console.log(`  Updated: ${updateCount}`);
    }
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Complete ===`);
    console.log(`Elapsed: ${elapsed}s`);
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
