import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null | undefined): string {
  if (!price) return "TBA";
  
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 2)}M`;
  }
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`;
  }
  return `$${price.toLocaleString()}`;
}

export function formatDropPercent(percent: number): string {
  return `-${percent}%`;
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "Unknown";
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/**
 * Generate a short title from listing details
 */
export function generateListingTitle(listing: {
  address?: string;
  suburb: string;
  postcode: string;
  priceText?: string;
}): string {
  const { address, suburb } = listing;
  
  // If we have an address, extract key parts
  if (address) {
    // Check for unit/apartment number
    const unitMatch = address.match(/^(\d+[A-Za-z]?\/|Unit\s*\d+[A-Za-z]?|Apt\s*\d+[A-Za-z]?)/i);
    
    // Check for street name (first few words after number)
    const streetMatch = address.match(/\d+\s+([A-Za-z]+\s*(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Way|Place|Pl|Court|Ct|Boulevard|Blvd))/i);
    
    if (unitMatch && streetMatch) {
      // Unit X on Street Name
      const street = streetMatch[1].replace(/\b(Street|Road|Avenue|Drive|Lane|Way|Place|Court|Boulevard)\b/i, (m) => {
        const map: Record<string, string> = {
          'Street': 'St', 'St': 'St',
          'Road': 'Rd', 'Rd': 'Rd',
          'Avenue': 'Ave', 'Ave': 'Ave',
          'Drive': 'Dr', 'Dr': 'Dr',
          'Lane': 'Ln', 'Way': 'Way',
          'Place': 'Pl', 'Pl': 'Pl',
          'Court': 'Ct', 'Ct': 'Ct',
          'Boulevard': 'Blvd', 'Blvd': 'Blvd',
        };
        return map[m] || m;
      });
      return `${unitMatch[1].replace(/\/$/, '')} ${street}, ${suburb}`;
    }
    
    if (streetMatch) {
      const street = streetMatch[1].replace(/\b(Street|Road|Avenue|Drive|Lane|Way|Place|Court|Boulevard)\b/i, (m) => {
        const map: Record<string, string> = {
          'Street': 'St', 'Road': 'Rd', 'Avenue': 'Ave',
          'Drive': 'Dr', 'Lane': 'Ln', 'Place': 'Pl', 'Court': 'Ct',
        };
        return map[m] || m;
      });
      return `${street}, ${suburb}`;
    }
    
    // Fallback: use first part of address
    const shortAddress = address.split(',')[0].trim();
    if (shortAddress.length < 30) {
      return `${shortAddress}, ${suburb}`;
    }
  }
  
  // Ultimate fallback
  return `Property in ${suburb}`;
}
