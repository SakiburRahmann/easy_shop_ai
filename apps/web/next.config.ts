import type { NextConfig } from 'next';

/**
 * Fully static export — the site is a client-side app that talks to the easyshop-api
 * Cloudflare Worker; all data flows through the public API, so no Node runtime is
 * needed and the output deploys directly to Cloudflare Pages (easyshopai.pages.dev).
 */
// NEXT_PUBLIC_API_URL is baked into the client bundle at build time
// (apps/web/src/lib/api.ts). A production build without it would silently
// ship a site that fetches http://localhost:8787 — broken for every visitor.
// Fail the build instead; `next dev` keeps the localhost fallback for local work.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is required for a production build of @easyshop/web (e.g. NEXT_PUBLIC_API_URL=https://easyshop-api.easyshop-api.workers.dev pnpm --filter @easyshop/web run build)',
  );
}

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Local previews are served from 127.0.0.1 while Next binds localhost.
  // This only affects `next dev`; the static export is unchanged.
  allowedDevOrigins: ['127.0.0.1'],
  // Set by the security upgrade flow (`next upgrade --agent=security`) so future
  // advisories are surfaced by the tooling instead of going unnoticed.
  experimental: { agentUpgrade: 'security' },
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
