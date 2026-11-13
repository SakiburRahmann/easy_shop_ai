import type { Metadata } from 'next';
import { Bricolage_Grotesque, Hind_Siliguri, Instrument_Serif, Inter } from 'next/font/google';
import './globals.css';

/* Latin UI in Inter; every Bengali glyph falls back to Hind Siliguri —
 * both self-hosted at build time, so ৳ and Bangla text render everywhere. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});
const bangla = Hind_Siliguri({
  subsets: ['latin', 'bengali'],
  display: 'swap',
  variable: '--font-bangla',
  weight: ['400', '500', '600', '700'],
});
/* Editorial display face used by the boutique template and serif themes. */
const display = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400'],
  style: ['normal', 'italic'],
});
/* Characterful grotesque for the modern template's oversized headlines. */
const grotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-grotesque',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'EasyShopAI — a marketplace where every shop has an AI agent',
  description:
    'Sellers open a complete online store in minutes — pick a template and colors, and get an AI agent that finds products, bargains fairly and takes COD orders in Bangla, English or Banglish.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bangla.variable} ${display.variable} ${grotesque.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
