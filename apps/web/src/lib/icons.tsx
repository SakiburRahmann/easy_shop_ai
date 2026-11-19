import type { SVGProps } from 'react';

/**
 * Self-hosted SVG icon set (lucide-style strokes). Using inline SVG instead
 * of emoji glyphs guarantees identical rendering on every device/OS/font.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Chat: (p: P) => (
    <Base {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Base>
  ),
  Send: (p: P) => (
    <Base {...p}>
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </Base>
  ),
  Bag: (p: P) => (
    <Base {...p}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Base>
  ),
  Package: (p: P) => (
    <Base {...p}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </Base>
  ),
  Phone: (p: P) => (
    <Base {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Base>
  ),
  Store: (p: P) => (
    <Base {...p}>
      <path d="m2 7 2-4h16l2 4" />
      <path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7" />
      <path d="M2 7h20" />
      <path d="M9 21v-7h6v7" />
    </Base>
  ),
  Search: (p: P) => (
    <Base {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Base>
  ),
  Plus: (p: P) => (
    <Base {...p}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Base>
  ),
  Minus: (p: P) => (
    <Base {...p}>
      <path d="M5 12h14" />
    </Base>
  ),
  X: (p: P) => (
    <Base {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Base>
  ),
  Check: (p: P) => (
    <Base {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Base>
  ),
  Trash: (p: P) => (
    <Base {...p}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Base>
  ),
  ArrowRight: (p: P) => (
    <Base {...p}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Base>
  ),
  ArrowLeft: (p: P) => (
    <Base {...p}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Base>
  ),
  Chevron: (p: P) => (
    <Base {...p}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  ),
  Spark: (p: P) => (
    <Base {...p}>
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
    </Base>
  ),
  Wallet: (p: P) => (
    <Base {...p}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </Base>
  ),
  Clock: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Base>
  ),
  Tag: (p: P) => (
    <Base {...p}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" />
    </Base>
  ),
  Palette: (p: P) => (
    <Base {...p}>
      <path d="M12 22a1 1 0 0 1-1-1v-1a2 2 0 0 0-2-2h-1a6 6 0 0 1-6-6v-1a8 8 0 0 1 8-8h1a8 8 0 0 1 8 8 4 4 0 0 1-4 4h-1a1 1 0 0 0-1 1v5a1 1 0 0 1-1 1z" />
      <circle cx="9" cy="7" r="0.5" fill="currentColor" />
      <circle cx="14" cy="6" r="0.5" fill="currentColor" />
      <circle cx="17" cy="10" r="0.5" fill="currentColor" />
    </Base>
  ),
  Message: (p: P) => (
    <Base {...p}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </Base>
  ),
  Eye: (p: P) => (
    <Base {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  ),
  Upload: (p: P) => (
    <Base {...p}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8" />
    </Base>
  ),
  Image: (p: P) => (
    <Base {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </Base>
  ),
  Globe: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </Base>
  ),
  Truck: (p: P) => (
    <Base {...p}>
      <path d="M5 18H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" />
      <path d="M14 9h4l4 4v3a2 2 0 0 1-2 2h-1" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
      <path d="M9 18h6" />
    </Base>
  ),
  Shield: (p: P) => (
    <Base {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.7 9-.2.1-.4.1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.6a1 1 0 0 1 1.3 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
    </Base>
  ),
  User: (p: P) => (
    <Base {...p}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Base>
  ),
  Logout: (p: P) => (
    <Base {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Base>
  ),
  Alert: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Base>
  ),
  Heart: (p: P) => (
    <Base {...p}>
      <path d="M19 14c1.5-1.5 3-3.4 3-5.5A5 5 0 0 0 12 5.5 5 5 0 0 0 2 8.5C2 12.5 7 16 12 21c5-5 7-7 7-7" />
    </Base>
  ),
  Home: (p: P) => (
    <Base {...p}>
      <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Base>
  ),
  Leaf: (p: P) => (
    <Base {...p}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a7 7 0 0 1-7 7z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </Base>
  ),
  Shirt: (p: P) => (
    <Base {...p}>
      <path d="M20 7 16 3H8L4 7l2 3 2-1v11h8V9l2 1z" />
      <path d="M8 3a4 4 0 0 0 8 0" />
    </Base>
  ),
  Laptop: (p: P) => (
    <Base {...p}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
    </Base>
  ),
  Smiley: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </Base>
  ),
  MapPin: (p: P) => (
    <Base {...p}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </Base>
  ),
  Menu: (p: P) => (
    <Base {...p}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Base>
  ),
  Star: (p: P) => (
    <Base {...p}>
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1z" />
    </Base>
  ),
};
