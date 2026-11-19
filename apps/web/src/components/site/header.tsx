'use client';

/**
 * Marketplace chrome, matched to the reference: brand mark, section links, a
 * pill search field with the dark "Chat with AI" button inside it, cart and
 * account. Used by the home, search, product, cart and dashboard screens.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/icons';
import { useCartCount } from '@/lib/cart';
import { AiChooser } from './ai-chooser';

const LINKS = [
  { label: 'Shop', href: '/search' },
  { label: 'Categories', href: '/#categories' },
  { label: 'Sell', href: '/dashboard' },
  { label: 'About', href: '/#about' },
];

export function SiteHeader({ query = '', onSearch }: { query?: string; onSearch?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const [menu, setMenu] = useState(false);
  const [chooser, setChooser] = useState(false);
  const cartCount = useCartCount();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setDraft(query));
  }, [query]);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        setSignedIn(Boolean(window.localStorage.getItem('easyshopai.token')));
      } catch {
        setSignedIn(false);
      }
    });
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = draft.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6 px-5 lg:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="EasyShopAI home">
            <QuintBag />
            <span className="text-[21px] font-extrabold leading-none tracking-[-0.045em] text-ink">
              EasyShopAI
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[12.5px] font-semibold text-ink/75 lg:flex">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-brand-600">
                {link.label}
              </Link>
            ))}
          </nav>

          <form
            onSubmit={submit}
            role="search"
            className="ml-auto hidden h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#f4f5f9] pl-4 pr-1 md:flex lg:max-w-[400px]"
          >
            <Icon.Spark size={14} className="shrink-0 text-muted" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Describe what you need…"
              aria-label="Search the marketplace"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-[#8b90a0]"
            />
            <button
              type="button"
              onClick={() => setChooser(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#0d1220] px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#1c2437]"
            >
              <Icon.Spark size={12} />
              Chat with AI
            </button>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0 md:gap-5">
            <Link
              href="/cart"
              className="relative flex h-9 w-9 items-center justify-center text-ink transition hover:text-brand-600"
              aria-label={`Cart${cartCount ? ` (${cartCount} items)` : ''}`}
            >
              <Icon.Bag size={20} />
              {cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9.5px] font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/dashboard"
              className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink transition hover:text-brand-600 sm:flex"
            >
              <Icon.User size={16} />
              {signedIn ? 'Dashboard' : 'Sign in'}
            </Link>
            <button
              type="button"
              onClick={() => setMenu((open) => !open)}
              aria-label="Menu"
              aria-expanded={menu}
              className="flex h-9 w-9 items-center justify-center text-ink lg:hidden"
            >
              {menu ? <Icon.X size={19} /> : <Icon.Menu size={19} />}
            </button>
          </div>
        </div>

        {menu ? (
          <div className="border-t border-line bg-white px-5 py-4 lg:hidden">
            <form
              onSubmit={submit}
              className="mb-3 flex h-10 items-center gap-2 rounded-full bg-[#f4f5f9] pl-4 pr-1"
            >
              <Icon.Search size={14} className="text-muted" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Describe what you need…"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <button
                type="submit"
                className="h-8 rounded-full bg-[#0d1220] px-3.5 text-[12px] font-semibold text-white"
              >
                Search
              </button>
            </form>
            <div className="flex flex-col">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenu(false)}
                  className="border-b border-line/70 py-2.5 text-[13px] font-semibold text-ink-soft"
                >
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setChooser(true);
                }}
                className="flex items-center gap-2 py-3 text-[13px] font-semibold text-brand-600"
              >
                <Icon.Spark size={15} />
                Chat with a shop&apos;s AI agent
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <AiChooser open={chooser} onClose={() => setChooser(false)} />
    </>
  );
}

/** Filled shopping-bag brand mark, as drawn in the reference header. */
function QuintBag() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.2 7.5h11.6a1.4 1.4 0 0 1 1.4 1.3l.7 10a2.2 2.2 0 0 1-2.2 2.3H6.3a2.2 2.2 0 0 1-2.2-2.3l.7-10a1.4 1.4 0 0 1 1.4-1.3Z"
        fill="#2f5bf0"
      />
      <path d="M9 8V6.6a3 3 0 0 1 6 0V8" stroke="#2f5bf0" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M8.6 11.2v1.2M15.4 11.2v1.2"
        stroke="white"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer id="about" className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-5 py-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2">
            <QuintBag />
            <span className="text-[19px] font-extrabold tracking-[-0.04em] text-ink">
              EasyShopAI
            </span>
          </Link>
          <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-muted">
            Great products. Brighter businesses. Every shop on EasyShopAI has an AI assistant that
            knows the real catalog, its stock and its prices.
          </p>
          <p className="max-w-[38ch] text-[11.5px] leading-relaxed text-muted/80">
            Orders are confirmed by phone and paid in cash on delivery.
          </p>
        </div>
        <FooterCol
          title="Shop"
          links={[
            ['All products', '/search'],
            ['Categories', '/#categories'],
            ['Your cart', '/cart'],
          ]}
        />
        <FooterCol
          title="Sell"
          links={[
            ['Open a store', '/dashboard'],
            ['Seller dashboard', '/dashboard'],
            ['Store themes', '/dashboard'],
          ]}
        />
        <FooterCol
          title="Platform"
          links={[
            ['About', '/#about'],
            ['AI assistant', '/#about'],
            ['Cash on delivery', '/#about'],
          ]}
        />
      </div>
      <div className="border-t border-line px-5 py-5 text-center text-[11px] text-muted">
        © {new Date().getFullYear()} EasyShopAI. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }): ReactNode {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">{title}</span>
      {links.map(([label, href]) => (
        <Link
          key={`${title}-${label}`}
          href={href}
          className="text-[12.5px] text-muted transition hover:text-brand-600"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
