"use client";

import { MapPin, Home, Bed, Bath, Car, TrendingDown, DollarSign, Building2, BarChart3 } from "lucide-react";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Dot,
  BarChart, Bar, Cell,
} from "recharts";

// Dynamically import Leaflet map (SSR disabled)
const SuburbMap = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div 
      className="h-96 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: "#1a1a1a" }}
    >
      <p style={{ color: "#666" }}>Loading map...</p>
    </div>
  ),
});

// Color scheme
const colors = {
  bgPrimary: "#0a0a0a",
  bgSecondary: "#141414",
  bgTertiary: "#1a1a1a",
  textPrimary: "#ffffff",
  textSecondary: "#888888",
  textTertiary: "#666666",
  red: "#ef4444",
  redBg: "rgba(239, 68, 68, 0.1)",
  green: "#22c55e",
  greenBg: "rgba(34, 197, 94, 0.1)",
  orange: "#f97316",
  orangeBg: "rgba(249, 115, 22, 0.1)",
  blue: "#3b82f6",
  blueBg: "rgba(59, 130, 246, 0.1)",
  purple: "#a855f7",
  purpleBg: "rgba(168, 85, 247, 0.1)",
  yellow: "#eab308",
  yellowBg: "rgba(234, 179, 8, 0.2)",
  pink: "#ec4899",
  cyan: "#06b6d4",
  border: "#222222",
};

// Chart colors
const CHART_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899",
  "#06b6d4", "#eab308", "#ef4444", "#8b5cf6", "#14b8a6",
  "#f43f5e", "#84cc16", "#0ea5e9", "#d946ef",
];

function formatPrice(price: number | undefined | null) {
  if (!price) return "N/A";
  if (price >= 1000000) return `$${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  return `$${price}`;
}

function parseAddress(address: any): string {
  if (!address) return ""
  if (typeof address === "string") {
    if (address.startsWith("{")) {
      try {
        const parsed = JSON.parse(address)
        const parts = [parsed.street, parsed.suburb, parsed.state, parsed.postcode].filter(Boolean)
        return parts.join(", ")
      } catch {
        return address
      }
    }
    return address
  }
  return String(address)
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="px-3 py-2 rounded-lg border shadow-lg"
        style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
      >
        <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          {label || payload[0].name}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color || colors.textSecondary }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function ListingCard({ listing }: { listing: any }) {
  const hasDrop = listing.initial_price && listing.initial_price > listing.current_price;
  const dropPercent = hasDrop 
    ? Math.round((listing.initial_price - listing.current_price) / listing.initial_price * 1000) / 10 
    : 0;
  
  const displayAddress = parseAddress(listing.address)
  const displayTitle = listing.title || displayAddress || "Property"

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border p-4 transition-all hover:border-red-500/50"
      style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
    >
      <div className="flex items-start gap-4">
        {/* Price Badge */}
        <div
          className="flex-shrink-0 w-24 h-16 rounded-lg flex flex-col items-center justify-center"
          style={{ backgroundColor: hasDrop ? colors.greenBg : colors.bgTertiary }}
        >
          <span className="text-lg font-bold" style={{ color: hasDrop ? colors.green : colors.textPrimary }}>
            {formatPrice(listing.current_price)}
          </span>
          {hasDrop && (
            <span className="text-xs font-medium" style={{ color: colors.green }}>
              -{dropPercent}%
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-medium mb-1 line-clamp-1" style={{ color: colors.textPrimary }}>
            {displayTitle}
          </h4>

          {listing.title && (
            <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: colors.textTertiary }}>
              {listing.suburb}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-2">
            {listing.property_type && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: colors.blueBg, color: colors.blue }}
              >
                {listing.property_type.split('/')[0].trim()}
              </span>
            )}
            {listing.bedrooms && (
              <span className="flex items-center gap-1 text-xs" style={{ color: colors.textSecondary }}>
                <Bed className="w-3.5 h-3.5" />{listing.bedrooms}
              </span>
            )}
            {listing.bathrooms && (
              <span className="flex items-center gap-1 text-xs" style={{ color: colors.textSecondary }}>
                <Bath className="w-3.5 h-3.5" />{listing.bathrooms}
              </span>
            )}
            {listing.car_spaces > 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: colors.textSecondary }}>
                <Car className="w-3.5 h-3.5" />{listing.car_spaces}
              </span>
            )}
          </div>

          {hasDrop && (
            <p className="text-xs" style={{ color: colors.textTertiary }}>
              Was {formatPrice(listing.initial_price)} · Save {formatPrice(listing.initial_price - listing.current_price)}
            </p>
          )}
        </div>
      </div>
    </a>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: "red" | "orange" | "green" | "blue" | "purple" | "default";
}) {
  const colorMap = {
    red: { bg: colors.redBg, text: colors.red },
    orange: { bg: colors.orangeBg, text: colors.orange },
    green: { bg: colors.greenBg, text: colors.green },
    blue: { bg: colors.blueBg, text: colors.blue },
    purple: { bg: colors.purpleBg, text: colors.purple },
    default: { bg: colors.bgTertiary, text: colors.textSecondary },
  };
  const c = colorMap[color];

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: c.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: c.text }} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: colors.textTertiary }}>
            {title}
          </p>
          <p className="text-xl font-bold" style={{ color: colors.textPrimary }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs" style={{ color: colors.textTertiary }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SuburbGroup({ 
  suburb, 
  listings, 
  minPrice, 
  maxPrice,
  defaultExpanded = false 
}: { 
  suburb: string
  listings: any[]
  minPrice: number
  maxPrice: number
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const sortedListings = [...listings].sort((a, b) => a.current_price - b.current_price)
  const displayListings = expanded ? sortedListings : sortedListings.slice(0, 5)
  
  const droppedCount = listings.filter(l => l.initial_price && l.initial_price > l.current_price).length

  return (
    <div
      className="rounded-xl border"
      style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: colors.bgTertiary }}
          >
            <MapPin className="w-5 h-5" style={{ color: colors.textSecondary }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
              {suburb.charAt(0).toUpperCase() + suburb.slice(1).toLowerCase()}
            </h3>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              {listings.length} listings · {formatPrice(minPrice)} - {formatPrice(maxPrice)}
              {droppedCount > 0 && ` · ${droppedCount} with drops`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
          >
            {listings.length}
          </span>
          <span
            className="px-2 py-1 rounded text-xs"
            style={{ color: colors.textTertiary }}
          >
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>

      {/* Listings */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {displayListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {!expanded && listings.length > 5 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setExpanded(true)}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
          >
            Show all {listings.length} listings
          </button>
        </div>
      )}
    </div>
  )
}

// Suburb coordinates from JSON file
import SUBURB_COORDS_DATA from "../../data/suburb-coords.json";
const SUBURB_COORDS: Record<string, { lat: number; lng: number }> = SUBURB_COORDS_DATA as any;

/* Old inline coords replaced with JSON import
const _SUBURB_COORDS_INLINE: Record<string, { lat: number; lng: number }> = {
  "chippendale": { "lat": -33.88539666666667, "lng": 151.20014274509802 },
  "burwood": { "lat": -33.87777620338982, "lng": 151.10294135593227 },
  "north sydney": { "lat": -33.83612189999999, "lng": 151.20766457142855 },
  "waterloo": { "lat": -33.90093643181817, "lng": 151.2093370454545 },
  "chatswood": { "lat": -33.797173350364965, "lng": 151.18029116788327 },
  "surry hills": { "lat": -33.88494561666666, "lng": 151.2123126666667 },
  "hurstville": { "lat": -33.96400644799999, "lng": 151.10226455999992 },
  "mosman": { "lat": -33.82684811258279, "lng": 151.24113317880796 },
  "liverpool": { "lat": -33.92490599130435, "lng": 150.91985443478248 },
  "bondi junction": { "lat": -33.89222207843139, "lng": 151.24970647058822 },
  "zetland": { "lat": -33.912614142857145, "lng": 151.2062922857143 },
  "pymble": { "lat": -33.7589365625, "lng": 151.1374521875 },
  "wahroonga": { "lat": -33.747981875, "lng": 151.117475 },
  "rosebery": { "lat": -33.9140508205128, "lng": 151.2000658974359 },
  "haymarket": { "lat": -33.88103625, "lng": 151.20151875 },
  "epping": { "lat": -33.77256847826087, "lng": 151.08384739130434 },
  "manly": { "lat": -33.80057507462686, "lng": 151.28632208955224 },
  "newtown": { "lat": -33.8964371875, "lng": 151.17773875 },
  "pyrmont": { "lat": -33.86949363636364, "lng": 151.19461454545454 },
  "gordon": { "lat": -33.756336666666664, "lng": 151.15013666666666 },
  "darlinghurst": { "lat": -33.87740461538462, "lng": 151.2206846153846 },
  "strathfield": { "lat": -33.87154243902439, "lng": 151.09451780487805 },
  "cronulla": { "lat": -34.058162040816324, "lng": 151.14992244897958 },
  "blacktown": { "lat": -33.77109912280702, "lng": 150.90815789473683 },
  "alexandria": { "lat": -33.90640703703704, "lng": 151.1917651851852 },
  "sydney": { "lat": -33.86776634146342, "lng": 151.2073287804878 },
  "parramatta": { "lat": -33.815342307692305, "lng": 151.00426153846155 },
  "maroubra": { "lat": -33.94882292682927, "lng": 151.23486536585365 },
  "randwick": { "lat": -33.921267, "lng": 151.242564 },
  "wolli creek": { "lat": -33.93275, "lng": 151.1404 },
  // New Epping area suburbs
  "beecroft": { "lat": -33.7625, "lng": 151.045 },
  "carlingford": { "lat": -33.7711, "lng": 151.0533 },
  "eastwood": { "lat": -33.7908, "lng": 151.0783 },
  "ryde": { "lat": -33.8134, "lng": 151.1036 },
  "marsfield": { "lat": -33.7778, "lng": 151.1 },
  // New Chatswood area suburbs
  "artarmon": { "lat": -33.8125, "lng": 151.1928 },
  "roseville": { "lat": -33.7892, "lng": 151.1781 },
  "willoughby": { "lat": -33.7969, "lng": 151.1928 },
  "crows nest": { "lat": -33.8256, "lng": 151.1953 },
  "st leonards": { "lat": -33.8247, "lng": 151.1994 },
  "castlecrag": { "lat": -33.8003, "lng": 151.2272 },
  // Ryde/Rhodes area
  "rhodes": { "lat": -33.8317, "lng": 151.0908 },
  "concord": { "lat": -33.8508, "lng": 151.0917 },
  "meadowbank": { "lat": -33.8217, "lng": 151.0917 },
  "wentworth point": { "lat": -33.8367, "lng": 151.0756 },
  "north strathfield": { "lat": -33.8714, "lng": 151.0897 },
  "newington": { "lat": -33.8469, "lng": 151.0644 },
  "sydney olympic park": { "lat": -33.8517, "lng": 151.0644 },
  // Olympic Park surroundings
  "auburn": { "lat": -33.8494, "lng": 151.0328 },
  "silverwater": { "lat": -33.8336, "lng": 151.0444 },
  "lidcombe": { "lat": -33.8617, "lng": 151.0306 },
  "regents park": { "lat": -33.8783, "lng": 151.0111 },
  // Other suburbs in DB
  "ashfield": { "lat": -33.8892, "lng": 151.1264 },
  "balmain": { "lat": -33.8553, "lng": 151.1739 },
  "bondi": { "lat": -33.8908, "lng": 151.2743 },
  "camperdown": { "lat": -33.8889, "lng": 151.1792 },
  "campsie": { "lat": -33.9172, "lng": 151.1017 },
  "coogee": { "lat": -33.9194, "lng": 151.2572 },
  "cremorne": { "lat": -33.8306, "lng": 151.2217 },
  "croydon": { "lat": -33.8772, "lng": 151.1153 },
  "dee why": { "lat": -33.7533, "lng": 151.2892 },
  "double bay": { "lat": -33.8758, "lng": 151.2392 },
  "drummoyne": { "lat": -33.8517, "lng": 151.1558 },
  "erskineville": { "lat": -33.9031, "lng": 151.1806 },
  "five dock": { "lat": -33.8689, "lng": 151.1297 },
  "glebe": { "lat": -33.8789, "lng": 151.1861 },
  "gladesville": { "lat": -33.8283, "lng": 151.1239 },
  "haberfield": { "lat": -33.8814, "lng": 151.1397 },
  "rodd point": { "lat": -33.8633, "lng": 151.1358 },
  "russell lea": { "lat": -33.8589, "lng": 151.1333 },
  "wareemba": { "lat": -33.8556, "lng": 151.1311 },
  "chiswick": { "lat": -33.8508, "lng": 151.1314 },
  "abbotsford": { "lat": -33.8514, "lng": 151.1239 },
  "homebush": { "lat": -33.8656, "lng": 151.0842 },
  "hunters hill": { "lat": -33.8358, "lng": 151.1403 },
  "kensington": { "lat": -33.9103, "lng": 151.2225 },
  "killara": { "lat": -33.7586, "lng": 151.1503 },
  "kirribilli": { "lat": -33.8450, "lng": 151.2122 },
  "kogarah": { "lat": -33.9583, "lng": 151.1319 },
  "leichhardt": { "lat": -33.8842, "lng": 151.1558 },
  "lindfield": { "lat": -33.7764, "lng": 151.1656 },
  "marrickville": { "lat": -33.9075, "lng": 151.1467 },
  "neutral bay": { "lat": -33.8333, "lng": 151.2189 },
  "northbridge": { "lat": -33.8078, "lng": 151.2147 },
  "paddington": { "lat": -33.8864, "lng": 151.2297 },
  "potts point": { "lat": -33.8731, "lng": 151.2225 },
  "redfern": { "lat": -33.8931, "lng": 151.2058 },
  "rozelle": { "lat": -33.8614, "lng": 151.1681 },
  "st peters": { "lat": -33.9094, "lng": 151.1731 },
  // Newtown area
  "stanmore": { "lat": -33.8911, "lng": 151.1667 },
  "enmore": { "lat": -33.8989, "lng": 151.1711 },
  "tempe": { "lat": -33.9233, "lng": 151.1667 },
  "sydenham": { "lat": -33.9178, "lng": 151.1611 },
  "petersham": { "lat": -33.8858, "lng": 151.1556 },
  "lewisham": { "lat": -33.8917, "lng": 151.1486 },
  "dulwich hill": { "lat": -33.9033, "lng": 151.1389 },
  "summer hill": { "lat": -33.8861, "lng": 151.1292 },
  "milsons point": { "lat": -33.8454, "lng": 151.2112 },
  "cammeray": { "lat": -33.8227, "lng": 151.215 },
  "naremburn": { "lat": -33.8167, "lng": 151.2018 },
  "vaucluse": { "lat": -33.8548, "lng": 151.277 },
  "rose bay": { "lat": -33.8729, "lng": 151.2673 },
  "bellevue hill": { "lat": -33.8823, "lng": 151.2581 },
  // Eastern suburbs
  "bondi beach": { "lat": -33.8908, "lng": 151.2743 },
  "dover heights": { "lat": -33.8694, "lng": 151.2747 },
  "tamarama": { "lat": -33.9042, "lng": 151.2625 },
  "bronte": { "lat": -33.9078, "lng": 151.2528 },
  "waverley": { "lat": -33.9036, "lng": 151.2389 },
  "clovelly": { "lat": -33.9158, "lng": 151.2611 },
  "north bondi": { "lat": -33.8806, "lng": 151.2808 },
  // Other missing suburbs
  "queens park": { "lat": -33.8975, "lng": 151.2258 },
  "centennial park": { "lat": -33.9011, "lng": 151.2222 },
  "rushcutters bay": { "lat": -33.8756, "lng": 151.2256 },
  "elizabeth bay": { "lat": -33.8708, "lng": 151.2225 },
  "woolloomooloo": { "lat": -33.8683, "lng": 151.2183 },
  "the rocks": { "lat": -33.8589, "lng": 151.2083 },
  "millers point": { "lat": -33.8608, "lng": 151.2022 },
  "ultimo": { "lat": -33.8817, "lng": 151.1972 },
  "darlington": { "lat": -33.8889, "lng": 151.1886 },
  "forest lodge": { "lat": -33.8833, "lng": 151.1778 },
  "annandale": { "lat": -33.8833, "lng": 151.1667 },
  "ashbury": { "lat": -33.9006, "lng": 151.1278 },
  "edgecliff": { "lat": -33.8779, "lng": 151.2369 },
  "woollahra": { "lat": -33.8884, "lng": 151.2372 },
  "lilyfield": { "lat": -33.8639, "lng": 151.1639 },
  "birchgrove": { "lat": -33.8542, "lng": 151.1722 },
  "beaconsfield": { "lat": -33.9094, "lng": 151.1886 },
  "lavender bay": { "lat": -33.8417, "lng": 151.2056 },
  "mcmahons point": { "lat": -33.8417, "lng": 151.2022 },
  "macquarie park": { "lat": -33.7775, "lng": 151.1197 },
  "denistone east": { "lat": -33.7956, "lng": 151.0864 },
  "turramurra": { "lat": -33.7422, "lng": 151.1244 },
  "castle hill": { "lat": -33.7333, "lng": 150.9972 },
  "chester hill": { "lat": -33.9139, "lng": 150.9806 },
  "penrith": { "lat": -33.7508, "lng": 150.6944 },
};
End of old inline coords */

export default function ListingsClient({ 
  groupedData, 
  stats 
}: { 
  groupedData: Array<{
    suburb: string
    listings: any[]
    count: number
    minPrice: number
    maxPrice: number
  }>
  stats: {
    totalListings: number
    totalSuburbs: number
  }
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "count" | "price">("count")

  // Calculate insights
  const allListings = useMemo(() => groupedData.flatMap(g => g.listings), [groupedData])
  
  const insights = useMemo(() => {
    const prices = allListings.map(l => l.current_price).filter(Boolean)
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    
    // Price distribution for line chart
    const priceRanges = [
      { range: '<$500K', min: 0, max: 500000 },
      { range: '$500K-$1M', min: 500000, max: 1000000 },
      { range: '$1M-$1.5M', min: 1000000, max: 1500000 },
      { range: '$1.5M-$2M', min: 1500000, max: 2000000 },
      { range: '$2M-$3M', min: 2000000, max: 3000000 },
      { range: '$3M+', min: 3000000, max: Infinity },
    ]
    const priceDistribution = priceRanges.map(r => ({
      name: r.range,
      count: prices.filter(p => p >= r.min && p < r.max).length,
    }))
    
    // Property types (all of them)
    const propertyTypes: Record<string, number> = {}
    allListings.forEach(l => {
      if (l.property_type) {
        const type = l.property_type.split('/')[0].trim()
        propertyTypes[type] = (propertyTypes[type] || 0) + 1
      }
    })
    const propertyTypeData = Object.entries(propertyTypes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
    
    // Top suburbs
    const topSuburbs = groupedData
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((s, i) => ({
        name: s.suburb.charAt(0).toUpperCase() + s.suburb.slice(1).toLowerCase(),
        size: s.count,
        count: s.count,
      }))
    
    // Map data - merge with coordinates
    const mapData = groupedData
      .filter(g => SUBURB_COORDS[g.suburb.toLowerCase()])
      .map(g => ({
        name: g.suburb,
        coordinates: [SUBURB_COORDS[g.suburb.toLowerCase()].lat, SUBURB_COORDS[g.suburb.toLowerCase()].lng] as [number, number],
        count: g.count,
      }))
    
    // Drops
    const withDrops = allListings.filter(l => l.initial_price && l.initial_price > l.current_price).length
    const dropPercent = allListings.length > 0 ? (withDrops / allListings.length * 100).toFixed(1) : '0'
    
    return {
      avgPrice,
      minPrice,
      maxPrice,
      priceDistribution,
      propertyTypeData,
      topSuburbs,
      mapData,
      withDrops,
      dropPercent,
    }
  }, [allListings, groupedData])

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchQuery) return groupedData
    return groupedData.filter(g => 
      g.suburb.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [groupedData, searchQuery])

  // Sort
  const sortedData = useMemo(() => {
    const data = [...filteredData]
    if (sortBy === "name") {
      data.sort((a, b) => a.suburb.localeCompare(b.suburb))
    } else if (sortBy === "count") {
      data.sort((a, b) => b.count - a.count)
    } else if (sortBy === "price") {
      data.sort((a, b) => a.minPrice - b.minPrice)
    }
    return data
  }, [filteredData, sortBy])

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
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="text-2xl">🐨</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: colors.textPrimary }}>
                  DropBear
                </h1>
                <p className="text-xs" style={{ color: colors.textSecondary }}>
                  NSW real estate price drops
                </p>
              </div>
            </a>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Home className="w-4 h-4" style={{ color: colors.textSecondary }} />
                <span style={{ color: colors.textSecondary }}>
                  {stats.totalListings.toLocaleString()} listings
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" style={{ color: colors.textSecondary }} />
                <span style={{ color: colors.textSecondary }}>
                  {stats.totalSuburbs} suburbs
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            title="Total Listings"
            value={stats.totalListings.toLocaleString()}
            subtitle={`${stats.totalSuburbs} suburbs`}
            icon={Home}
            color="blue"
          />
          <StatCard
            title="Avg Price"
            value={formatPrice(insights.avgPrice)}
            icon={DollarSign}
            color="green"
          />
          <StatCard
            title="Price Range"
            value={formatPrice(insights.minPrice)}
            subtitle={`to ${formatPrice(insights.maxPrice)}`}
            icon={BarChart3}
            color="orange"
          />
          <StatCard
            title="Price Drops"
            value={insights.withDrops}
            subtitle={`${insights.dropPercent}% of listings`}
            icon={TrendingDown}
            color="red"
          />
        </div>

        {/* Map Section */}
        <div
          className="rounded-xl border p-6 mb-8"
          style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
        >
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4" style={{ color: colors.blue }} />
            <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
              Sydney Metro Map · {insights.mapData.length} suburbs with location data
            </h3>
          </div>
          <SuburbMap mapData={insights.mapData} />
          <p className="text-xs mt-3" style={{ color: colors.textTertiary }}>
            Circle size = listing count · Hover for details · Scroll to zoom
          </p>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          {/* Property Types - Horizontal Bar */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4" style={{ color: colors.purple }} />
              <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                Property Types ({insights.propertyTypeData.length} types)
              </h3>
            </div>
            <div className="h-80 overflow-y-auto">
              <ResponsiveContainer width="100%" height={insights.propertyTypeData.length * 32 + 20}>
                <BarChart 
                  data={insights.propertyTypeData} 
                  layout="vertical"
                  margin={{ left: 100, right: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    stroke={colors.textTertiary}
                    tick={{ fill: colors.textTertiary, fontSize: 11 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke={colors.textTertiary}
                    tick={{ fill: colors.textSecondary, fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]}
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {insights.propertyTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Price Distribution - Line Chart with Dots */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
          >
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4" style={{ color: colors.green }} />
              <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                Price Distribution
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={insights.priceDistribution}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis 
                    dataKey="name" 
                    stroke={colors.textTertiary}
                    tick={{ fill: colors.textTertiary, fontSize: 12 }}
                  />
                  <YAxis 
                    stroke={colors.textTertiary}
                    tick={{ fill: colors.textTertiary, fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke={colors.green}
                    strokeWidth={2}
                    dot={<Dot r={5} fill={colors.green} stroke={colors.bgPrimary} strokeWidth={2} />}
                    activeDot={<Dot r={7} fill={colors.green} stroke={colors.bgPrimary} strokeWidth={2} />}
                    animationBegin={0}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.blueBg }}
            >
              <Home className="w-5 h-5" style={{ color: colors.blue }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: colors.textPrimary }}>
                All Listings by Suburb
              </h2>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Click to expand · Sorted by {sortBy === 'count' ? 'listing count' : sortBy === 'price' ? 'lowest price' : 'name'}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search suburbs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg text-sm border focus:outline-none focus:border-blue-500"
            style={{
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "count" | "price")}
            className="px-4 py-2 rounded-lg text-sm border focus:outline-none"
            style={{
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
          >
            <option value="count">Sort by Count</option>
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price (Low)</option>
          </select>
        </div>

        {/* Suburbs List */}
        <div className="space-y-3">
          {sortedData.map((group) => (
            <SuburbGroup
              key={group.suburb}
              suburb={group.suburb}
              listings={group.listings}
              minPrice={group.minPrice}
              maxPrice={group.maxPrice}
            />
          ))}
        </div>

        {sortedData.length === 0 && (
          <div
            className="text-center py-16 rounded-xl border"
            style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
          >
            <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textTertiary }} />
            <p className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              No suburbs found
            </p>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Try a different search term
            </p>
          </div>
        )}
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
  )
}
