import Storefront from '@/components/Storefront';

/**
 * Static export shell. /s/* paths are served with this file (Pages `_redirects`
 * rewrite); the slug is read client-side from the URL, so any shop works at
 * https://easyshopai.pages.dev/s/<slug> without server-side routing.
 */
export default function SPage() {
  return <Storefront />;
}
