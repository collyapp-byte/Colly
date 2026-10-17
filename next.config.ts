import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
