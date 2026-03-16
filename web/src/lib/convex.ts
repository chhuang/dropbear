import { ConvexHttpClient } from "convex/browser";

// Server-side Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://merry-flamingo-664.convex.cloud";

export const convexClient = new ConvexHttpClient(convexUrl);
