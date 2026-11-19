import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Serif, Inter } from 'next/font/google';
import './globals.css';

/* English-only interface: Inter for every UI string. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
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
    'Shop independent stores and unique brands in one place. Every shop has an AI assistant that knows the real catalog, its stock and its prices.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${grotesque.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
