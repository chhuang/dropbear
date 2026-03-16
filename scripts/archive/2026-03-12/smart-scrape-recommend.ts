#!/usr/bin/env npx tsx
/**
 * Smart scrape recommender
 * Run this to get a list of suburbs that need scraping
 * 
 * Usage: npx tsx scripts/smart-scrape-recommend.ts [--limit=15]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'web/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const MIN_DAYS_BETWEEN_SCRAPES = 7;
const DEFAULT_LIMIT = 15;

interface SuburbStats {
  suburb: string;
  listing_count: number;
  last_scraped: string | null;
  days_since_scrape: number;
  priority_score: number;
}

async function getRecommendations(limit: number = DEFAULT_LIMIT) {
  console.log('\n=== Smart Scrape Recommender ===\n');
  
  // Get listing counts per suburb
  const { data: listings } = await supabase
    .from('listings')
    .select('suburb');
  
  if (!listings) {
    console.log('Error: Could not fetch listings');
    return;
  }
  
  const suburbCounts: Record<string, number> = {};
  listings.forEach(l => {
    if (l.suburb) {
      const key = l.suburb.toLowerCase();
      suburbCounts[key] = (suburbCounts[key] || 0) + 1;
    }
  });
  
  // Get last scrape times
  const { data: runs } = await supabase
    .from('apify_runs')
    .select('suburb, started_at');
  
  const lastScraped: Record<string, string> = {};
  runs?.forEach(r => {
    if (r.suburb && r.started_at) {
      const key = r.suburb.toLowerCase();
      const existing = lastScraped[key];
      if (!existing || new Date(r.started_at) > new Date(existing)) {
        lastScraped[key] = r.started_at;
      }
    }
  });
  
  // Calculate priority scores
  const now = Date.now();
  const stats: SuburbStats[] = Object.entries(suburbCounts)
    .filter(([_, count]) => count >= 5) // Skip low-listing suburbs
    .map(([suburb, count]) => {
      const lastScrape = lastScraped[suburb];
      const daysSinceScrape = lastScrape 
        ? Math.floor((now - new Date(lastScrape).getTime()) / (1000 * 60 * 60 * 24))
        : 999; // Never scraped = high priority
      
      // Priority = listing_count * (days_since_scrape / 7)
      const priorityScore = count * (daysSinceScrape / MIN_DAYS_BETWEEN_SCRAPES);
      
      return {
        suburb,
        listing_count: count,
        last_scraped: lastScrape || null,
        days_since_scrape: daysSinceScrape,
        priority_score: Math.round(priorityScore),
      };
    })
    .filter(s => s.days_since_scrape >= MIN_DAYS_BETWEEN_SCRAPES)
    .sort((a, b) => b.priority_score - a.priority_score);
  
  // Output
  console.log(`Total suburbs with listings: ${Object.keys(suburbCounts).length}`);
  console.log(`Suburbs needing scrape (>${MIN_DAYS_BETWEEN_SCRAPES} days): ${stats.length}`);
  console.log(`\nTop ${limit} recommendations:\n`);
  
  console.log('| # | Suburb | Listings | Days Since Scrape | Priority |');
  console.log('|---|--------|----------|-------------------|----------|');
  
  stats.slice(0, limit).forEach((s, i) => {
    const lastScrape = s.last_scraped ? s.last_scraped.split('T')[0] : 'never';
    console.log(`| ${i + 1} | ${s.suburb} | ${s.listing_count} | ${s.days_since_scrape}d (${lastScrape}) | ${s.priority_score} |`);
  });
  
  // Copy-paste ready list
  console.log(`\n\`\`\`bash`);
  console.log(`# Suburbs to scrape today (${limit}):`);
  stats.slice(0, limit).forEach(s => {
    console.log(`npx tsx cron-scrape.ts ${s.suburb.replace(/\s+/g, '-')} <postcode>`);
  });
  console.log(`\`\`\``);
  
  // Summary stats
  const neverScraped = stats.filter(s => s.days_since_scrape === 999).length;
  const stale = stats.filter(s => s.days_since_scrape >= 14).length;
  
  console.log(`\n---`);
  console.log(`Never scraped: ${neverScraped} suburbs`);
  console.log(`Very stale (14+ days): ${stale} suburbs`);
  console.log(`Est. cost for ${limit} runs: $${(limit * 0.14).toFixed(2)}`);
}

// Parse args
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : DEFAULT_LIMIT;

getRecommendations(limit).catch(console.error);
