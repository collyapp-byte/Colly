import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Modern formats first: AVIF (smallest, LCP-friendly) with WebP as the
  // fallback for browsers that do not accept it. The optimizer picks by the
  // request's `Accept` header, so the hero JPEG (~284 kB raw) is served as a
  // fraction of that size on mobile.
  images: {
    formats: ["image/avif", "image/webp"],
    /* No asset in `public/` is wider than ~2048 px, so asking the optimizer for
       a 3840 candidate only produces an upscaled AVIF -- the most memory-hungry
       transform in the pipeline, and the one that intermittently answered 502 on
       the deployed host. Capping the candidate list keeps every transform a
       downscale of the shipped file. */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },
  // `sharp` rasterises badge SVGs to PNG at runtime and `@resvg/resvg-js` is the
  // optional fallback; both are loaded dynamically, so keep them out of the
  // bundle rather than letting the bundler try to resolve the (optional) fallback.
  serverExternalPackages: ["sharp", "@resvg/resvg-js"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
 allowedDevOrigins: ['192.168.1.174', '*.trycloudflare.com'],
};

export default nextConfig;
