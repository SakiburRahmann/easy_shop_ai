import type { NextConfig } from 'next';

/**
 * Fully static export — the site is a client-side app that talks to the easyshop-api
 * Cloudflare Worker; all data flows through the public API, so no Node runtime is
 * needed and the output deploys directly to Cloudflare Pages (easyshopai.pages.dev).
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
