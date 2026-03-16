"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { useLeafletContext } from "@react-leaflet/core";
import type { Feature, Geometry, Polygon, MultiPolygon, Position } from "geojson";
import * as L from "leaflet";
// @ts-ignore - leaflet types are incomplete
const Leaflet = L as any;
import "leaflet/dist/leaflet.css";

// Color scheme - subtle purple/violet
const colors = {
  bgPrimary: "#0a0a0a",
  bgTertiary: "#1a1a1a",
  textPrimary: "#ffffff",
  textSecondary: "#888888",
  textTertiary: "#666666",
  // Subtle purple/violet accent
  accentLow: "rgba(167, 139, 250, 0.08)",
  accentHigh: "rgba(167, 139, 250, 0.22)",
  border: "rgba(255, 255, 255, 0.06)",
  borderHover: "rgba(255, 255, 255, 0.2)",
};

interface SuburbProperties {
  nsw_loca_2: string;
  [key: string]: unknown;
}

interface GeoJsonData {
  type: "FeatureCollection";
  features: Feature<Geometry, SuburbProperties>[];
}

interface MapComponentProps {
  mapData: Array<{
    name: string;
    count: number;
    coordinates: [number, number];
  }>;
}

// Color gradient based on count - subtle purple/violet
function getCountColor(count: number, maxCount: number): string {
  const intensity = Math.min(count / maxCount, 1);
  // Stronger purple gradient
  const alpha = 0.15 + intensity * 0.3;
  return `rgba(167, 139, 250, ${alpha})`;
}

// Get font size based on count (scale between 13-18px)
function getLabelSize(count: number, maxCount: number): number {
  const intensity = Math.min(count / maxCount, 1);
  return 13 + intensity * 5;
}

// Get label opacity based on count (more listings = more visible)
function getLabelOpacity(count: number, maxCount: number): number {
  const intensity = Math.min(count / maxCount, 1);
  return 0.7 + intensity * 0.3;
}

// Calculate centroid of polygon for label placement
function getCentroid(geometry: Geometry): [number, number] | null {
  let coords: Position[][] = [];
  
  if (geometry.type === "Polygon") {
    coords = (geometry as Polygon).coordinates;
  } else if (geometry.type === "MultiPolygon") {
    // Use the largest polygon
    const multi = (geometry as MultiPolygon).coordinates;
    coords = multi.reduce((a, b) => a.length > b.length ? a : b, []);
  }
  
  if (!coords.length || !coords[0].length) return null;
  
  // Calculate centroid of outer ring
  const ring = coords[0];
  let sumLat = 0, sumLng = 0;
  ring.forEach(coord => {
    sumLng += coord[0];
    sumLat += coord[1];
  });
  
  return [sumLat / ring.length, sumLng / ring.length];
}

function GeoJsonLayer({ 
  geoData, 
  listingCounts,
  maxCount,
}: { 
  geoData: GeoJsonData;
  listingCounts: Map<string, number>;
  maxCount: number;
}) {
  const context = useLeafletContext();
  const [currentZoom, setCurrentZoom] = useState(11);
  
  useEffect(() => {
    const map = context.map;
    
    const updateZoom = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', updateZoom);
    updateZoom();
    
    return () => {
      map.off('zoomend', updateZoom);
    };
  }, [context.map]);
  
  useEffect(() => {
    const layerGroup = Leaflet.layerGroup();
    
    geoData.features.forEach((feature) => {
      const suburbName = feature.properties?.nsw_loca_2?.toLowerCase() || "";
      const count = listingCounts.get(suburbName) || 0;
      const hasListings = count > 0;
      const centroid = getCentroid(feature.geometry);
      
      const geoJsonLayer = Leaflet.geoJSON(feature, {
        style: {
          fillColor: hasListings ? getCountColor(count, maxCount) : "transparent",
          fillOpacity: 1,
          color: hasListings ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
          weight: hasListings ? 1 : 0.5,
          opacity: 1,
        },
        onEachFeature: (feature: any, layer: any) => {
          // Hover effects
          layer.on({
            mouseover: (e: any) => {
              const target = e.target;
              target.setStyle({
                weight: 2,
                color: "rgba(255, 255, 255, 0.35)",
                fillOpacity: 1,
                fillColor: hasListings ? `rgba(167, 139, 250, ${0.35 + (count / maxCount) * 0.2})` : "rgba(255, 255, 255, 0.06)",
              });
              target.bringToFront();
            },
            mouseout: (e: any) => {
              const target = e.target;
              target.setStyle({
                fillColor: hasListings ? getCountColor(count, maxCount) : "transparent",
                fillOpacity: 1,
                color: hasListings ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
                weight: hasListings ? 1 : 0.5,
                opacity: 1,
              });
            },
          });
          
          // Tooltip on hover - compact black popup
          layer.bindTooltip(
            `<div style="padding: 5px 8px; text-align: center; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;">
              <div style="font-weight: 600; text-transform: capitalize; font-size: 11px; color: #fff;">${suburbName}</div>
              <div style="font-size: 10px; color: #666; margin-top: 1px;">${count} listings</div>
            </div>`,
            {
              direction: "top",
              offset: [0, -5],
              opacity: 1,
              className: "suburb-tooltip",
            }
          );
        },
      });
      
      layerGroup.addLayer(geoJsonLayer);
      
      // Add center label with count - only show at zoom >= 12
      if (centroid && hasListings && currentZoom >= 12) {
        const fontSize = getLabelSize(count, maxCount);
        const opacity = getLabelOpacity(count, maxCount);
        const labelMarker = Leaflet.marker([centroid[0], centroid[1]], {
          icon: Leaflet.divIcon({
            className: "suburb-label",
            html: `<div style="
              font-size: ${fontSize}px;
              font-weight: 600;
              color: rgba(255, 255, 255, ${opacity});
              text-shadow: 0 1px 3px rgba(0,0,0,0.9);
              white-space: nowrap;
              pointer-events: none;
              letter-spacing: -0.5px;
            ">${count}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, 10],
          }),
          interactive: false,
        });
        layerGroup.addLayer(labelMarker);
      }
    });
    
    layerGroup.addTo(context.map);
    
    return () => {
      layerGroup.remove();
    };
  }, [context.map, geoData, listingCounts, maxCount, currentZoom]);
  
  return null;
}

export default function MapComponent({ mapData }: MapComponentProps) {
  const [mounted, setMounted] = useState(false);
  const [geoData, setGeoData] = useState<GeoJsonData | null>(null);
  
  useEffect(() => {
    setMounted(true);
    
    // Load GeoJSON
    fetch("/nsw-suburbs.geojson")
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Failed to load GeoJSON:", err));
  }, []);
  
  // Create lookup map for listing counts
  const listingCounts = useMemo(() => {
    const map = new Map<string, number>();
    mapData.forEach(d => {
      map.set(d.name.toLowerCase(), d.count);
    });
    return map;
  }, [mapData]);
  
  // Filter GeoJSON to only suburbs we have data for
  const filteredGeoData = useMemo(() => {
    if (!geoData) return null;
    
    const suburbNames = new Set(mapData.map(d => d.name.toLowerCase()));
    
    const features = geoData.features.filter(f => {
      const name = f.properties?.nsw_loca_2?.toLowerCase() || "";
      return suburbNames.has(name);
    });
    
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [geoData, mapData]);
  
  const maxCount = Math.max(...mapData.map(d => d.count), 1);
  
  // Sydney center
  const center: [number, number] = [-33.85, 151.1];
  
  if (!mounted) {
    return (
      <div 
        className="h-96 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: colors.bgTertiary }}
      >
        <p style={{ color: colors.textTertiary }}>Loading map...</p>
      </div>
    );
  }
  
  if (!filteredGeoData) {
    return (
      <div 
        className="h-[500px] rounded-lg flex items-center justify-center"
        style={{ backgroundColor: colors.bgTertiary }}
      >
        <p style={{ color: colors.textTertiary }}>Loading suburb boundaries...</p>
      </div>
    );
  }
  
  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "500px", width: "100%", borderRadius: "8px" }}
        scrollWheelZoom={true}
      >
        {/* Dark map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Suburb polygons */}
        <GeoJsonLayer 
          geoData={filteredGeoData}
          listingCounts={listingCounts}
          maxCount={maxCount}
        />
      </MapContainer>
      
      {/* Legend */}
      <div 
        className="absolute bottom-4 left-4 px-3 py-2 rounded-lg"
        style={{ backgroundColor: "rgba(10, 10, 10, 0.85)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-xs mb-1.5" style={{ color: colors.textSecondary }}>
          Listing density
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "rgba(167, 139, 250, 0.15)" }} />
          <span className="text-xs" style={{ color: colors.textTertiary }}>Few</span>
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: "rgba(167, 139, 250, 0.45)" }} />
          <span className="text-xs" style={{ color: colors.textTertiary }}>Many</span>
        </div>
      </div>
    </div>
  );
}
