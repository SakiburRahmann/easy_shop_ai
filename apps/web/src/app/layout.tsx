import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyShopAI — Your AI-powered shop',
  description:
    'Open a storefront and sell with an AI sales assistant that finds products, bargains fairly and takes COD orders — in Bangla, English or Banglish.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
