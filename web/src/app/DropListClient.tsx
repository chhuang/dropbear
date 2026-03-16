"use client";

import { TrendingDown, Share2, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { getDrops } from "@/actions/getDrops";

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
  yellow: "#eab308",
  yellowBg: "rgba(234, 179, 8, 0.2)",
  border: "#222222",
};

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

// Format helpers
function formatPrice(price: number | undefined | null) {
  if (!price) return "N/A";
  if (price >= 1000000) return `$${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  return `$${price}`;
}

function formatDropAmount(amount: number) {
  if (amount >= 1000000) return `-$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `-$${(amount / 1000).toFixed(0)}K`;
  return `-$${amount}`;
}

function formatDropPercent(percent: number) {
  return `-${percent.toFixed(1)}%`;
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "yesterday";
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Drop Card Component
function DropCard({
  dropGroup,
  rank,
}: {
  dropGroup: {
    listingId: string;
    listing: any;
    totalDropAmount: number;
    totalDropPercent: number;
    initialPrice: number;
    currentPrice: number;
    drops: Array<{
      _id: string;
      previousPrice: number;
      newPrice: number;
      dropAmount: number;
      dropPercent: number;
      detectedAt: number;
    }>;
    latestDetectedAt: number;
  };
  rank: number;
}) {
  const listing = dropGroup.listing;
  const [expanded, setExpanded] = useState(false);
  const hasMultipleDrops = dropGroup.drops.length > 1;
  const isNew = Date.now() - dropGroup.latestDetectedAt < 86400000;

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        backgroundColor: colors.bgSecondary,
        borderColor: colors.border,
      }}
    >
      <a
        href={listing?.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-4 p-4"
        onMouseEnter={(e) => (e.currentTarget.parentElement!.style.borderColor = colors.red)}
        onMouseLeave={(e) => (e.currentTarget.parentElement!.style.borderColor = colors.border)}
      >
        {/* Rank Badge */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold"
          style={{
            backgroundColor: rank === 1 ? colors.yellowBg : colors.bgTertiary,
            color: rank === 1 ? colors.yellow : colors.textSecondary,
          }}
        >
          #{rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-base font-semibold truncate mb-1" style={{ color: colors.textPrimary }}>
            {listing?.title || parseAddress(listing?.address) || "Property"}
          </h3>

          {/* Location */}
          <p className="text-sm mb-2" style={{ color: colors.textSecondary }}>
            {listing?.suburb?.toUpperCase()} · NSW
          </p>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {listing?.propertyType && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium uppercase"
                style={{ backgroundColor: colors.blueBg, color: colors.blue }}
              >
                {listing.propertyType.replace(/([A-Z])/g, " $1").trim()}
              </span>
            )}

            {listing?.bedrooms && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: colors.redBg, color: colors.red }}
              >
                {listing.bedrooms} BR
              </span>
            )}

            {isNew && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: colors.orangeBg, color: colors.orange }}
              >
                RECENT DROP
              </span>
            )}

            {hasMultipleDrops && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: colors.greenBg, color: colors.green }}
              >
                {dropGroup.drops.length} DROPS
              </span>
            )}
          </div>

          {/* Total Price Change */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold" style={{ color: colors.red }}>
              {formatDropAmount(dropGroup.totalDropAmount)}
            </span>
            <span className="text-sm font-medium" style={{ color: colors.red }}>
              ({formatDropPercent(dropGroup.totalDropPercent)})
            </span>
            <span className="text-sm" style={{ color: colors.textTertiary }}>
              {formatPrice(dropGroup.initialPrice)} → {formatPrice(dropGroup.currentPrice)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {hasMultipleDrops && (
            <button
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: colors.bgTertiary }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" style={{ color: colors.textSecondary }} />
              ) : (
                <ChevronDown className="w-4 h-4" style={{ color: colors.textSecondary }} />
              )}
            </button>
          )}

          <button
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: colors.bgTertiary }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (navigator.share) {
                navigator.share({
                  title: listing?.title || "Property Price Drop",
                  url: listing?.url || window.location.href,
                });
              }
            }}
          >
            <Share2 className="w-4 h-4" style={{ color: colors.textSecondary }} />
          </button>
        </div>
      </a>

      {/* Individual Drops (expanded) */}
      {expanded && hasMultipleDrops && (
        <div className="px-4 pb-4">
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ backgroundColor: colors.bgTertiary }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: colors.textTertiary }}>
              Price History ({dropGroup.drops.length} drops)
            </p>
            {dropGroup.drops.map((drop) => (
              <div key={drop._id} className="flex items-center justify-between text-sm">
                <span style={{ color: colors.textSecondary }}>
                  {formatRelativeTime(drop.detectedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ color: colors.textTertiary }}>
                    {formatPrice(drop.previousPrice)} → {formatPrice(drop.newPrice)}
                  </span>
                  <span style={{ color: colors.red }} className="font-medium">
                    -{drop.dropPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Stats Card Component
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
  color?: "red" | "orange" | "green" | "default";
}) {
  const colorMap = {
    red: { bg: colors.redBg, text: colors.red },
    orange: { bg: colors.orangeBg, text: colors.orange },
    green: { bg: colors.greenBg, text: colors.green },
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
  );
}

// Main Client Component
export default function DropListClient({
  dropsData: initialDropsData,
  statsData: initialStatsData,
}: {
  dropsData?: any[];
  statsData?: { 
    totalDrops: number;
    totalListings?: number;
    totalSuburbs?: number;
  };
}) {
  const [dropsData, setDropsData] = useState(initialDropsData || []);
  const [statsData, setStatsData] = useState(initialStatsData || { totalDrops: 0, totalListings: 0, totalSuburbs: 0 });
  const [loading, setLoading] = useState(!initialDropsData?.length);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getDrops();
        setDropsData(data.drops);
        setStatsData(data.stats);
      } catch (error) {
        console.error('Failed to fetch drops:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const [selectedSuburb, setSelectedSuburb] = useState<string>("all");

  // Calculate averages
  const avgDropPercent = useMemo(() => {
    if (!dropsData || dropsData.length === 0) return "0";
    const sum = dropsData.reduce((acc, d) => acc + d.totalDropPercent, 0);
    return (sum / dropsData.length).toFixed(1);
  }, [dropsData]);

  // Filter by suburb
  const filteredDrops = useMemo(() => {
    if (!dropsData) return [];
    if (selectedSuburb === "all") return dropsData;
    return dropsData.filter(d => d.listing?.suburb?.toLowerCase() === selectedSuburb.toLowerCase());
  }, [dropsData, selectedSuburb]);

  // Get unique suburbs
  const suburbs = useMemo(() => {
    if (!dropsData) return [];
    const uniqueSuburbs = [...new Set(dropsData.map(d => d.listing?.suburb).filter(Boolean))];
    return uniqueSuburbs.sort() as string[];
  }, [dropsData]);

  const biggestDrop = dropsData?.[0];

  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          title="Total Drops"
          value={statsData.totalDrops}
          icon={TrendingDown}
          color={statsData.totalDrops > 0 ? "red" : "default"}
        />
        <StatCard
          title="Avg Drop %"
          value={`${avgDropPercent}%`}
          icon={TrendingDown}
          color="orange"
        />
        <StatCard
          title="Biggest Drop"
          value={biggestDrop ? formatDropAmount(biggestDrop.totalDropAmount) : "-"}
          subtitle={biggestDrop ? formatDropPercent(biggestDrop.totalDropPercent) : undefined}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          title="Properties Scanning"
          value={statsData.totalListings?.toLocaleString() || "0"}
          subtitle={`${statsData.totalSuburbs || 0} suburbs`}
          icon={TrendingDown}
        />
      </div>

      {/* Filter Bar */}
      {suburbs.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: colors.textSecondary }} />
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              Filter by suburb:
            </span>
          </div>
          <select
            value={selectedSuburb}
            onChange={(e) => setSelectedSuburb(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border focus:outline-none"
            style={{
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
          >
            <option value="all">All Suburbs ({dropsData?.length || 0} properties)</option>
            {suburbs.map((suburb) => {
              const count = dropsData?.filter(d => d.listing?.suburb?.toLowerCase() === suburb.toLowerCase()).length || 0;
              return (
                <option key={suburb} value={suburb}>
                  {suburb.charAt(0).toUpperCase() + suburb.slice(1)} ({count})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Price Drops Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: colors.redBg }}
          >
            <TrendingDown className="w-5 h-5" style={{ color: colors.red }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.textPrimary }}>
              Price Drops
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Ranked by total percentage drop · NSW-wide
            </p>
          </div>
        </div>

        {filteredDrops.length > 0 ? (
          <div className="space-y-2">
            {filteredDrops.map((drop, index) => (
              <DropCard key={drop.listingId} dropGroup={drop} rank={index + 1} />
            ))}
          </div>
        ) : (
          <div
            className="text-center py-16 rounded-xl border"
            style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
          >
            <TrendingDown className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textTertiary }} />
            <p className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {selectedSuburb === "all" ? "No price drops yet" : "No drops in this suburb"}
            </p>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              {selectedSuburb === "all"
                ? "Check back after the next scrape! Drops will appear here when prices change."
                : "Try selecting a different suburb or view all drops."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
