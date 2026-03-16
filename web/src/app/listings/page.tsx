import { createClient } from '@supabase/supabase-js'
import ListingsClient from './ListingsClient'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
)

// Revalidate every 5 minutes
// No caching during development
export const dynamic = 'force-dynamic';

export default async function ListingsPage() {
  // Fetch all active listings with prices
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .not('current_price', 'is', null)
    .gt('current_price', 0)
    .order('suburb')
    .order('current_price', { ascending: true })

  // Group by suburb
  const groupedBySuburb: Record<string, typeof listings> = {}
  ;(listings || []).forEach(listing => {
    const suburb = listing.suburb || 'Unknown'
    if (!groupedBySuburb[suburb]) {
      groupedBySuburb[suburb] = []
    }
    groupedBySuburb[suburb].push(listing)
  })

  // Sort suburbs alphabetically
  const sortedSuburbs = Object.keys(groupedBySuburb).sort((a, b) => 
    a.localeCompare(b)
  )

  const groupedData = sortedSuburbs.map(suburb => ({
    suburb,
    listings: groupedBySuburb[suburb] || [],
    count: groupedBySuburb[suburb]?.length || 0,
    minPrice: Math.min(...(groupedBySuburb[suburb] || []).map(l => l.current_price)),
    maxPrice: Math.max(...(groupedBySuburb[suburb] || []).map(l => l.current_price)),
  }))

  const stats = {
    totalListings: listings?.length || 0,
    totalSuburbs: sortedSuburbs.length,
  }

  return <ListingsClient groupedData={groupedData} stats={stats} />
}
