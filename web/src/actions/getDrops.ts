'use server'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
)

export async function getDrops() {
  // Query only the columns we need for drops
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, listing_id, address, suburb, state, postcode, url, current_price, initial_price, price_text, last_seen_at, is_active')
    .eq('is_active', true)
    .not('initial_price', 'is', null)
    .not('current_price', 'is', null)
  
  if (error) {
    console.error('Supabase error:', error)
    return { drops: [], stats: { totalDrops: 0, totalListings: 0, totalSuburbs: 0 } }
  }
  
  const droppedListings = (listings || [])
    .filter(l => l.initial_price && l.current_price && l.initial_price > l.current_price)
    .map(l => {
      const totalDropAmount = l.initial_price - l.current_price
      const totalDropPercent = Math.round((totalDropAmount / l.initial_price) * 100 * 10) / 10
      
      return {
        listingId: l.id,
        listing: l,
        totalDropAmount,
        totalDropPercent,
        initialPrice: l.initial_price,
        currentPrice: l.current_price,
        latestDetectedAt: new Date(l.last_seen_at).getTime(),
        drops: [],
      }
    })
    .sort((a, b) => b.totalDropPercent - a.totalDropPercent)
  
  return {
    drops: droppedListings,
    stats: {
      totalDrops: droppedListings.length,
      totalListings: listings?.length || 0,
      totalSuburbs: new Set(listings?.map(s => s.suburb) || []).size,
    }
  }
}
