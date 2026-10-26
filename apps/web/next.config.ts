import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@listing-validator/api-client", "@listing-validator/types"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
