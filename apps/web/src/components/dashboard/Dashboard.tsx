'use client';

/**
 * Seller dashboard: login → shop onboarding → products/orders/chats/settings.
 * Speaks exclusively to easyshop-api with the seller's Supabase access token.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  type Session,
  type Shop,
  shopCreateInputSchema,
  type ShopCreateInput,
} from '@easyshop/shared';
import { api, ApiError, signIn } from '@/lib/api';
import { Button, ErrorNote, Field, Spinner, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
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
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Icon.Store size={16} />
            </span>
            <span className="text-[17px] font-bold tracking-tight">
              Easy<span className="text-brand-600">Shop</span>AI
            </span>
          </Link>
          {shop ? (
            <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              <Icon.Store size={12} />
              {shop.name}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-sm">
            {shop ? (
              <a
                href={`/s?shop=${shop.slug}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:text-brand-700"
              >
                <Icon.Eye size={14} />
                View store
              </a>
            ) : null}
            <Button variant="ghost" onClick={logout} icon={<Icon.Logout size={14} />}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {shop ? (
          <>
            <nav className="mb-6 flex gap-1 rounded-2xl bg-zinc-100 p-1 text-sm font-medium">
              {(
                [
                  ['products', 'Products', <Icon.Package key="p" size={15} />],
                  ['orders', 'Orders', <Icon.Bag key="o" size={15} />],
                  ['chats', 'Chats', <Icon.Message key="c" size={15} />],
                  ['settings', 'Settings', <Icon.Palette key="s" size={15} />],
                ] as const
              ).map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 transition ${
                    tab === key
                      ? 'bg-white shadow-sm text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {icon}
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
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-900/[0.04]"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/30">
            <Icon.Store size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Easy<span className="text-brand-600">Shop</span>AI
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Sign in to run your store</p>
          </div>
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
        <Button type="submit" disabled={busy} className="w-full" size="lg">
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
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState<'classic' | 'modern'>('classic');
  const [color, setColor] = useState('#059669');
  const [tone, setTone] = useState<'friendly' | 'formal' | 'playful'>('friendly');
  const [discount, setDiscount] = useState(10);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const input = shopCreateInputSchema.safeParse({
      name,
      ...(description ? { description } : {}),
      ...(phone ? { contact: { phone } } : {}),
      templateId: template,
      theme: { primaryColor: color },
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Invalid shop details');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const shop = await auth<Shop>('/shops', { body: input.data as ShopCreateInput });
      // Seed the agent — best-effort: the shop exists either way, and the
      // seller can fine-tune everything later in Settings.
      try {
        await auth<unknown>(`/shops/${shop.id}/ai-settings`, {
          method: 'PATCH',
          body: {
            tone,
            languages: ['bn', 'en'],
            maxDiscountPct: discount,
            ...(extra ? { extraInstructions: extra } : {}),
          },
        });
      } catch {
        /* non-fatal */
      }
      onCreated(shop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shop creation failed');
    } finally {
      setBusy(false);
    }
  };

  const swatches = ['#059669', '#0EA5E9', '#7C3AED', '#D97706', '#E11D48', '#334155'];

  return (
    <div className="flex flex-1 justify-center p-6">
      <div className="flex w-full max-w-xl flex-col gap-5 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-900/[0.04]">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon.Store size={14} />
            </span>
            Set up your online shop
          </h1>
          <p className="text-sm text-zinc-500">
            Signed in as {email} — three quick steps and your store is live with its own AI agent.
          </p>
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand-600' : 'bg-zinc-200'}`}
              />
            ))}
          </div>
        </div>

        {step === 1 ? (
          <div className="flex flex-col gap-4">
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
            <Field label="WhatsApp / phone (optional)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className={inputClass}
              />
            </Field>
            <Button
              onClick={() => {
                if (name.trim().length > 0 && name.trim().length <= 80) setStep(2);
                else setError('Please enter your shop name');
              }}
              className="self-end"
              icon={<Icon.ArrowRight size={15} />}
            >
              Continue
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <Field label="Template" hint="How your storefront is laid out">
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['classic', 'Classic', 'Clean product grid'],
                    ['modern', 'Modern', 'Hero banner + editorial cards'],
                  ] as const
                ).map(([val, label, blurb]) => (
                  <button
                    key={val}
                    onClick={() => setTemplate(val)}
                    className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                      template === val
                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs text-zinc-500">{blurb}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Brand color">
              <div className="flex flex-wrap items-center gap-2">
                {swatches.map((c) => (
                  <button
                    key={c}
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full transition ${
                      color === c ? 'ring-2 ring-zinc-900 ring-offset-2' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-zinc-300"
                  aria-label="Custom color"
                />
                <span className="font-mono text-xs text-zinc-500">{color}</span>
              </div>
            </Field>
            <Field label="Preview">
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <div
                  className="flex items-center gap-2 px-3 py-2 text-white"
                  style={{ backgroundColor: color }}
                >
                  <span className="text-xs font-bold">{name || 'Your shop'}</span>
                </div>
                {template === 'modern' ? (
                  <div className="px-4 py-3 text-white" style={{ backgroundColor: `${color}cc` }}>
                    <span className="text-xs font-semibold">
                      {description || 'Curated for you'}
                    </span>
                  </div>
                ) : null}
                <div className="grid grid-cols-4 gap-2 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex aspect-square flex-col gap-1 rounded bg-zinc-100 p-1"
                    >
                      <span className="text-[8px] text-zinc-400">item</span>
                    </div>
                  ))}
                </div>
              </div>
            </Field>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                icon={<Icon.ArrowLeft size={15} />}
              >
                Back
              </Button>
              <Button onClick={() => setStep(3)} icon={<Icon.ArrowRight size={15} />}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="AI tone" hint="How it talks to your customers">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                  className={inputClass}
                >
                  <option value="friendly">friendly</option>
                  <option value="formal">formal</option>
                  <option value="playful">playful</option>
                </select>
              </Field>
              <Field label="Max bargaining discount" hint="Server-enforced cap">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="flex-1 accent-emerald-600"
                  />
                  <span className="w-10 text-right text-sm font-semibold">{discount}%</span>
                </div>
              </Field>
            </div>
            <Field
              label="Owner instructions for the agent (optional)"
              hint="Promos, size guidance, etiquette — the AI follows these"
            >
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={3}
                maxLength={2000}
                className={inputClass}
              />
            </Field>
            <p className="text-xs text-zinc-400">
              Your agent can be re-tuned any time from Settings → AI assistant. Bangla, Banglish and
              English are supported.
            </p>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                icon={<Icon.ArrowLeft size={15} />}
              >
                Back
              </Button>
              <Button onClick={() => void create()} disabled={busy} icon={<Icon.Check size={15} />}>
                {busy ? 'Creating your store…' : 'Create shop'}
              </Button>
            </div>
          </div>
        ) : null}

        <ErrorNote message={error} />
      </div>
    </div>
  );
}
