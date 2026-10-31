'use client';

/**
 * Seller dashboard: login → shop onboarding → products/orders/chats/settings.
 * Speaks exclusively to easyshop-api with the seller's Supabase access token.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  type Session,
  type Shop,
  shopCreateInputSchema,
  type ShopCreateInput,
} from '@easyshop/shared';
import { api, ApiError, signIn } from '@/lib/api';
import { Button, ErrorNote, Field, Spinner, inputClass } from '@/components/ui';
import ProductsTab from './ProductsTab';
import OrdersTab from './OrdersTab';
import ChatsTab from './ChatsTab';
import SettingsTab from './SettingsTab';

const TOKEN_KEY = 'easyshopai.token';
const USER_KEY = 'easyshopai.user';

export type Api = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;

export default function Dashboard() {
  const [ready, setReady] = useState(
    () => typeof window === 'undefined' || !window.localStorage.getItem(TOKEN_KEY),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [tab, setTab] = useState<'products' | 'orders' | 'chats' | 'settings'>('products');

  /** Authenticated API helper; logs out on expired tokens. */
  const auth = useCallback(
    <T,>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
      const token = window.localStorage.getItem(TOKEN_KEY) ?? '';
      return api<T>(path, { ...options, token }).catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
          setSession(null);
          setShop(null);
        }
        throw err;
      });
    },
    [],
  );

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setSession(null);
    setShop(null);
  };

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token || !ready) return;
    let cancelled = false;
    api<unknown>('/auth/me', { token })
      .then((raw) => {
        if (cancelled) return;
        const r = raw as { user?: { id: string; email: string }; shop?: Shop | null };
        if (r.user) {
          setSession({ user: r.user, accessToken: token, refreshToken: '' });
          setShop(r.shop ?? null);
        } else {
          window.localStorage.removeItem(TOKEN_KEY);
          setReady(true);
        }
      })
      .catch((err) => {
        if (!(err instanceof ApiError)) window.localStorage.removeItem(TOKEN_KEY);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const afterLogin = (s: Session) => {
    window.localStorage.setItem(TOKEN_KEY, s.accessToken);
    window.localStorage.setItem(
      USER_KEY,
      JSON.stringify({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
    );
    setSession(s);
    api<unknown>('/auth/me', { token: s.accessToken })
      .then((raw) => {
        const r = raw as { shop?: Shop | null };
        setShop(r.shop ?? null);
      })
      .catch(() => {});
  };

  if (!ready) return <Spinner />;

  if (!session) return <LoginPanel onLogin={afterLogin} />;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">
            Easy<span className="text-emerald-600">Shop</span>AI
          </span>
          {shop ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {shop.name}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-sm">
            {shop ? (
              <a
                href={`/s?shop=${shop.slug}`}
                target="_blank"
                rel="noopener"
                className="text-emerald-600 hover:underline"
              >
                /s?shop={shop.slug} ↗
              </a>
            ) : null}
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {shop ? (
          <>
            <nav className="mb-6 flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm font-medium">
              {(
                [
                  ['products', 'Products'],
                  ['orders', 'Orders'],
                  ['chats', 'Chats'],
                  ['settings', 'Settings'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 rounded-lg px-3 py-2 transition ${
                    tab === key ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'products' ? <ProductsTab auth={auth} shop={shop} /> : null}
            {tab === 'orders' ? <OrdersTab auth={auth} shop={shop} /> : null}
            {tab === 'chats' ? <ChatsTab auth={auth} shop={shop} /> : null}
            {tab === 'settings' ? (
              <SettingsTab auth={auth} shop={shop} onShopChange={setShop} />
            ) : null}
          </>
        ) : (
          <Onboarding onCreated={setShop} auth={auth} email={session.user.email} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── login ─────────────────────────────────── */

function LoginPanel({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('demo@easyshopai.dev');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await signIn({ email, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="text-center">
          <h1 className="text-xl font-bold">
            Easy<span className="text-emerald-600">Shop</span>AI
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Seller sign in</p>
        </div>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <ErrorNote message={error} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-xs text-zinc-400">
          Demo seller: demo@easyshopai.dev / easyshop-demo1
        </p>
      </form>
    </div>
  );
}

/* ───────────────────────────── onboarding ──────────────────────────────── */

function Onboarding({
  onCreated,
  auth,
  email,
}: {
  onCreated: (shop: Shop) => void;
  auth: Api;
  email: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const input = shopCreateInputSchema.safeParse({
      name,
      ...(description ? { description } : {}),
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Invalid shop details');
      return;
    }
    setBusy(true);
    try {
      onCreated(await auth<Shop>('/shops', { body: input.data as ShopCreateInput }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shop creation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={create}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold">Create your shop</h1>
          <p className="text-sm text-zinc-500">
            Signed in as {email}. A shop URL is generated from your name.
          </p>
        </div>
        <Field label="Shop name" hint="e.g. Rahman Fashion → /s?shop=rahman-fashion">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
            minLength={1}
            maxLength={80}
          />
        </Field>
        <Field label="Short description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={1000}
            className={inputClass}
          />
        </Field>
        <ErrorNote message={error} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating…' : 'Create shop'}
        </Button>
      </form>
    </div>
  );
}
