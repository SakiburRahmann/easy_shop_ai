import Storefront from '@/components/Storefront';

/**
 * Static export shell. /s/* paths are served with this file (Pages `_redirects`
 * rewrite); the slug and optional product id are read client-side from the
 * URL, so any shop works at /s?shop=<slug> (and /s?shop=<slug>&product=<id>)
 * without server-side routing.
 */
export default function SPage() {
  return <Storefront />;
}
