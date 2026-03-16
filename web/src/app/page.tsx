import { createClient } from '@supabase/supabase-js'
import DropListClient from './DropListClient'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://pfmziwdqslxgkyszgdah.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_B0YYihysMll5uCDx7aruHA_jPIpb54H'
)

// Color scheme
const colors = {
  bgPrimary: "#0a0a0a",
  bgSecondary: "#141414",
  border: "#222222",
  textPrimary: "#ffffff",
  textSecondary: "#888888",
  textTertiary: "#666666",
  red: "#ef4444",
  redBg: "rgba(239, 68, 68, 0.1)",
};

// No caching during development
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component - fetches data from Supabase
export default async function HomePage() {
  // Fetch all active listings
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('is_active', true)
  
  // Filter for dropped listings (initial_price > current_price)
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
        drops: [], // Individual drop history not tracked after table deletion
      }
    })
    .sort((a, b) => b.totalDropPercent - a.totalDropPercent)
  
  // Calculate stats
  const totalListings = listings?.length || 0
  const totalDrops = droppedListings.length
  const uniqueSuburbs = new Set(listings?.map(s => s.suburb) || []).size
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgPrimary }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          backgroundColor: `rgba(10, 10, 10, 0.9)`,
          borderColor: colors.border,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🐨</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: colors.textPrimary }}>
                  DropBear
                </h1>
                <p className="text-xs" style={{ color: colors.textSecondary }}>
                  NSW real estate price drops
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span style={{ color: colors.textSecondary }}>LIVE</span>
              </div>
              <div style={{ color: colors.textTertiary }}>
                {totalDrops} drops
              </div>
              <a 
                href="/listings" 
                className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: colors.textSecondary }}
              >
                All Listings
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <DropListClient 
          dropsData={droppedListings} 
          statsData={{ 
            totalDrops,
            totalListings,
            totalSuburbs: uniqueSuburbs,
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-12" style={{ borderColor: colors.border }}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs" style={{ color: colors.textTertiary }}>
            DropBear · NSW real estate price tracker · Updated daily
          </p>
        </div>
      </footer>
    </div>
  );
}
