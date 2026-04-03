import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses
  compress: true,

  // Standalone output for smaller Docker/EC2 deployments
  // output: 'standalone',

  // Experimental features for performance
  experimental: {
    // Parallelise route rendering
    serverActions: { bodySizeLimit: "2mb" },
  },

  // Custom HTTP response headers — cache static assets aggressively
  async headers() {
    return [
      {
        // Next.js static chunks — cache forever (they have hash in filename)
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // API routes — short server-side cache to prevent hammering AWS APIs
        // 30 seconds: data feels live but avoids repeated identical calls
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" },
        ],
      },
      {
        // Cost API — can cache a bit longer (billing data updates once/day)
        source: "/api/cost",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
      {
        // Security API — slightly longer cache (groups don't change every second)
        source: "/api/security",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
