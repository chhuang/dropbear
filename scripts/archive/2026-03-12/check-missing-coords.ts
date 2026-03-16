#!/usr/bin/env npx tsx
/**
 * Check for suburbs missing coordinates and fetch them
 * Usage: npx tsx check-missing-coords.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
)

const COORDS_FILE = path.join(new URL('.', import.meta.url).pathname, '../web/src/data/suburb-coords.json')

interface Coordinate {
  lat: number
  lng: number
}

async function checkMissingCoords() {
  console.log('Checking for suburbs without coordinates...\n')
  
  // Get all suburbs with listings
  const { data: suburbs, error } = await supabase
    .from('listings')
    .select('suburb')
    .eq('is_active', true)
    .gt('current_price', 0)
    .order('suburb')
  
  if (error) {
    console.error('Error fetching suburbs:', error)
    process.exit(1)
  }
  
  const uniqueSuburbs = [...new Set(suburbs.map(s => s.suburb))]
  console.log(`Found ${uniqueSuburbs.length} active suburbs in database`)
  
  // Load existing coordinates
  let existingCoords: Record<string, Coordinate> = {}
  try {
    const coordsData = fs.readFileSync(COORDS_FILE, 'utf8')
    existingCoords = JSON.parse(coordsData)
  } catch (e) {
    console.log('No existing coords file found')
  }
  
  // Find missing
  const missing: string[] = []
  for (const suburb of uniqueSuburbs) {
    if (!existingCoords[suburb]) {
      missing.push(suburb)
    }
  }
  
  if (missing.length === 0) {
    console.log('✅ All suburbs have coordinates')
    process.exit(0)
  }
  
  console.log(`\n⚠️  Missing coordinates for ${missing.length} suburbs:`)
  missing.forEach(s => console.log(`  - ${s}`))
  
  // Fetch coordinates from listings (centroid)
  console.log('\nFetching coordinates from listing data...')
  const newCoords: Record<string, Coordinate> = {}
  
  for (const suburb of missing) {
    const { data } = await supabase
      .from('listings')
      .select('lat, lng')
      .eq('suburb', suburb)
      .eq('is_active', true)
      .not('lat', null)
      .not('lng', null)
      .limit(1)
    
    if (data && data.length > 0 && data[0].lat && data[0].lng) {
      newCoords[suburb] = {
        lat: data[0].lat,
        lng: data[0].lng
      }
      console.log(`  ✓ ${suburb}: ${data[0].lat}, ${data[0].lng}`)
    } else {
      console.log(`  ⚠ No coordinates found for ${suburb}`)
    }
  }
  
  // Merge with existing
  const merged = { ...existingCoords, ...newCoords }
  
  // Write back
  fs.writeFileSync(COORDS_FILE, JSON.stringify(merged, null, 2))
  console.log(`\n✅ Updated ${COORDS_FILE}`)
  console.log(`   Added: ${Object.keys(newCoords).length} new suburbs`)
}

checkMissingCoords()
