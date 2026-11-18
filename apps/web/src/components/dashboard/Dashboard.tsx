'use client';

/**
 * Seller dashboard: sign up / log in → store builder → products, orders,
 * chats and settings. Speaks exclusively to easyshop-api with the seller's
 * access token.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  BUSINESS_TYPE_PRESETS,
  STOREFRONT_TEMPLATES,
  sessionSchema,
  shopCreateInputSchema,
  signInInputSchema,
  signUpInputSchema,
  type BusinessType,
  type DeliveryZone,
  type Session,
  type Shop,
  type TemplateId,
} from '@easyshop/shared';
import { api, ApiError, signIn } from '@/lib/api';
import { Button, ErrorNote, Field, Spinner, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { TEMPLATE_VISUALS } from '@/components/storefront/templates';
import {
  BusinessTypePicker,
  DeliveryZoneEditor,
  MiniStorePreview,
  TemplatePicker,
  ThemeControls,
  type ThemeValue,
} from './store-builder';
import ProductsTab from './ProductsTab';
import OrdersTab from './OrdersTab';
import ChatsTab from './ChatsTab';
import SettingsTab from './SettingsTab';
import ThemeGallery from './ThemeGallery';

const TOKEN_KEY = 'easyshopai.token';
const USER_KEY = 'easyshopai.user';

const DEFAULT_THEME: ThemeValue = {
  primaryColor: '#059669',
  accentColor: '#F59E0B',
  font: 'sans',
};

const DEFAULT_ZONES: DeliveryZone[] = [
  { name: 'Inside Dhaka', charge: 60, etaDays: 1 },
  { name: 'Outside Dhaka', charge: 120, etaDays: 3 },
];

export type Api = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;

export default function Dashboard() {
  // Always start "not ready": the first paint is a spinner on both the server
  // (static export) and the client, so hydration never mismatches. The session
  // restore below is the only thing that can flip this.
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [tab, setTab] = useState<'products' | 'orders' | 'chats' | 'theme' | 'settings'>(
    'products',
  );

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
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    if (!token) {
      // Microtask, not a synchronous write inside the effect.
      void Promise.resolve().then(finish);
      return () => {
        cancelled = true;
      };
    }

    api<unknown>('/auth/me', { token })
      .then((raw) => {
        if (cancelled) return;
        const r = raw as { user?: { id: string; email: string }; shop?: Shop | null };
        if (r.user) {
          setSession({ user: r.user, accessToken: token, refreshToken: '' });
          setShop(r.shop ?? null);
        } else {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
        }
      })
      .catch(() => {
        // Expired/invalid token: forget it and show the login form instead of
        // retrying forever behind the loading spinner.
        if (cancelled) return;
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
      })
      .finally(finish);
    return () => {
      cancelled = true;
    };
  }, []);

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
            <span className="flex max-w-[46vw] items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              <Icon.Store size={12} className="shrink-0" />
              <span className="truncate">{shop.name}</span>
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
            <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 text-sm font-medium [scrollbar-width:none] [&>button]:shrink-0">
              {(
                [
                  ['products', 'Products', <Icon.Package key="p" size={15} />],
                  ['orders', 'Orders', <Icon.Bag key="o" size={15} />],
                  ['chats', 'Chats', <Icon.Message key="c" size={15} />],
                  ['theme', 'Theme', <Icon.Palette key="d" size={15} />],
                  ['settings', 'Store & AI', <Icon.Palette key="s" size={15} />],
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
            {tab === 'theme' ? (
              <ThemeGallery auth={auth} shop={shop} onShopChange={setShop} />
            ) : null}
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
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const input = signUpInputSchema.safeParse({
          email,
          password,
          ...(name.trim() ? { name: name.trim() } : {}),
        });
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? 'Check your details');
          return;
        }
        const session = sessionSchema.parse(
          await api<unknown>('/auth/signup', { body: input.data }),
        );
        onLogin(session);
      } else {
        const input = signInInputSchema.safeParse({ email, password });
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? 'Check your details');
          return;
        }
        onLogin(await signIn(input.data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
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
            <p className="mt-1 text-sm text-zinc-500">
              {mode === 'login'
                ? 'Sign in to run your store'
                : 'Create your account and open a store in minutes'}
            </p>
          </div>
        </div>

        {mode === 'signup' ? (
          <Field label="Your name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoComplete="name"
              maxLength={80}
              placeholder="e.g. Rahman"
            />
          </Field>
        ) : null}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </Field>

        <ErrorNote message={error} />

        <Button type="submit" disabled={busy} className="w-full" size="lg">
          {busy
            ? mode === 'login'
              ? 'Signing in…'
              : 'Creating account…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
          className="text-center text-xs text-zinc-500 transition hover:text-zinc-800"
        >
          {mode === 'login' ? (
            <>
              New to EasyShopAI?{' '}
              <span className="font-semibold text-brand-700">Open your shop</span>
            </>
          ) : (
            <>
              Already have an account? <span className="font-semibold text-brand-700">Sign in</span>
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-zinc-400">
          Demo seller: demo@easyshopai.dev / easyshop-demo1
        </p>
      </form>
    </div>
  );
}

/* ───────────────────────────── store builder ───────────────────────────── */

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
  const [businessType, setBusinessType] = useState<BusinessType>('fashion');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [templateId, setTemplateId] = useState<TemplateId>(
    BUSINESS_TYPE_PRESETS.fashion.suggestedTemplate,
  );
  const [theme, setTheme] = useState<ThemeValue>({
    ...DEFAULT_THEME,
    font: TEMPLATE_VISUALS[BUSINESS_TYPE_PRESETS.fashion.suggestedTemplate].defaultFont,
  });
  const [zones, setZones] = useState<DeliveryZone[]>(DEFAULT_ZONES);
  const [tone, setTone] = useState<'friendly' | 'formal' | 'playful'>('friendly');
  const [bn, setBn] = useState(true);
  const [en, setEn] = useState(true);
  const [discount, setDiscount] = useState(10);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState<Shop | null>(null);

  const preset = BUSINESS_TYPE_PRESETS[businessType];

  const chooseBusiness = (next: BusinessType) => {
    setBusinessType(next);
    const suggested = BUSINESS_TYPE_PRESETS[next].suggestedTemplate;
    setTemplateId(suggested);
    setTheme((current) => ({
      ...current,
      font: TEMPLATE_VISUALS[suggested].defaultFont,
    }));
  };

  const chooseTemplate = (next: TemplateId) => {
    setTemplateId(next);
    setTheme((current) => ({
      ...current,
      font: TEMPLATE_VISUALS[next].defaultFont,
    }));
  };

  const create = async () => {
    if (!bn && !en) {
      setError('Choose at least one language for the AI agent');
      return;
    }
    const cleanedZones = zones
      .filter((zone) => zone.name.trim())
      .map((zone) => ({ ...zone, name: zone.name.trim() }));
    const uniqueNames = new Set(cleanedZones.map((zone) => zone.name.toLowerCase()));
    if (uniqueNames.size !== cleanedZones.length) {
      setError('Delivery zone names must be unique');
      return;
    }

    const input = shopCreateInputSchema.safeParse({
      name: name.trim(),
      businessType,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(phone.trim() ? { contact: { phone: phone.trim() } } : {}),
      templateId,
      theme: {
        primaryColor: theme.primaryColor,
        accentColor: theme.accentColor,
        font: theme.font,
      },
      deliveryRules: { zones: cleanedZones },
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Check your store details');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const shop = await auth<Shop>('/shops', { body: input.data });
      // The shop exists at this point; AI settings are best-effort so a
      // transient failure cannot orphan a successfully launched store.
      try {
        await auth<unknown>(`/shops/${shop.id}/ai-settings`, {
          method: 'PATCH',
          body: {
            tone,
            languages: [bn ? 'bn' : '', en ? 'en' : ''].filter(Boolean),
            maxDiscountPct: discount,
            ...(extra.trim() ? { extraInstructions: extra.trim() } : {}),
          },
        });
      } catch {
        /* seller can re-save from Store & AI */
      }
      setLaunched(shop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Store creation failed');
    } finally {
      setBusy(false);
    }
  };

  if (launched) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-xl shadow-zinc-900/[0.04]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <Icon.Check size={28} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Your store is live</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {launched.name} is online, its AI agent is on, and the {preset.categories.length}{' '}
            starter categories are ready.
          </p>
        </div>

        <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Storefront
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-700">/s?shop={launched.slug}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {preset.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-200"
              >
                {category}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Add products and the assistant can immediately find them, quote prices and take COD
          orders. Signed in as {email}.
        </p>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => onCreated(launched)}
            icon={<Icon.Plus size={16} />}
          >
            Add your first product
          </Button>
          <a
            href={`/s?shop=${launched.slug}`}
            target="_blank"
            rel="noopener"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:text-brand-700"
          >
            <Icon.Eye size={15} />
            View store
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xl shadow-zinc-900/[0.04] sm:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Icon.Store size={14} />
          </span>
          Build your online store
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {email}. 4 steps: business, storefront, delivery, launch.
        </p>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand-600' : 'bg-zinc-200'}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-400">
          <span>Business</span>
          <span>Design</span>
          <span>Delivery</span>
          <span>AI & launch</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-medium text-zinc-700">What do you sell?</p>
            <p className="mb-2 text-xs text-zinc-400">
              We set up the right starter categories and template for your kind of store.
            </p>
            <BusinessTypePicker value={businessType} onChange={chooseBusiness} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shop name" hint={`Storefront: /s?shop=${name ? '…' : 'your-shop'}`}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
                minLength={1}
                maxLength={80}
                placeholder="e.g. Rahman Fashion"
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
          </div>
          <Field label="Short description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              className={inputClass}
              placeholder="What makes your shop worth visiting?"
            />
          </Field>
          <div className="rounded-xl bg-brand-50/70 px-3 py-2.5 text-xs text-brand-800">
            We will create these categories for you:{' '}
            <span className="font-medium">{preset.categories.join(' · ')}</span>
          </div>
          <Button
            onClick={() => {
              if (name.trim().length > 0 && name.trim().length <= 80) {
                setError(null);
                setStep(2);
              } else {
                setError('Please enter your shop name');
              }
            }}
            className="self-end"
            icon={<Icon.ArrowRight size={15} />}
          >
            Continue to design
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[13px] font-medium text-zinc-700">Pick a storefront template</p>
            <p className="mb-2 text-xs text-zinc-400">
              You can switch templates later without losing products or orders.
            </p>
            <TemplatePicker
              value={templateId}
              onChange={chooseTemplate}
              primary={theme.primaryColor}
              accent={theme.accentColor}
            />
          </div>
          <ThemeControls value={theme} onChange={setTheme} />
          <div>
            <p className="mb-2 text-[13px] font-medium text-zinc-700">Live preview</p>
            <MiniStorePreview
              name={name}
              description={description}
              templateId={templateId}
              theme={theme}
              categories={preset.categories}
            />
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)} icon={<Icon.ArrowLeft size={15} />}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} icon={<Icon.ArrowRight size={15} />}>
              Continue to delivery
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-medium text-zinc-700">Where do you deliver?</p>
            <p className="mb-2 text-xs text-zinc-400">
              The AI quotes these charges and checkout adds the chosen zone to the COD total. Leave
              a zone empty to remove it.
            </p>
            <DeliveryZoneEditor zones={zones} onChange={setZones} />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
            <Icon.Truck size={13} className="mr-1 inline" />
            Tip: most Bangladeshi shops start with Inside Dhaka (৳60, 1 day) and Outside Dhaka
            (৳120, 3 days). You can edit these any time.
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)} icon={<Icon.ArrowLeft size={15} />}>
              Back
            </Button>
            <Button onClick={() => setStep(4)} icon={<Icon.ArrowRight size={15} />}>
              Continue to AI
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-medium text-zinc-700">Tune your AI sales agent</p>
            <p className="mb-2 text-xs text-zinc-400">
              It will greet customers, search your catalog, negotiate within your limits and take
              COD orders.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tone" hint="How it talks">
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
            <Field label="Languages" hint="Banglish is auto-detected">
              <div className="flex gap-3 pt-1 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={bn}
                    onChange={(e) => setBn(e.target.checked)}
                    className="accent-emerald-600"
                  />{' '}
                  বাংলা
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={en}
                    onChange={(e) => setEn(e.target.checked)}
                    className="accent-emerald-600"
                  />{' '}
                  English
                </label>
              </div>
            </Field>
          </div>
          <Field
            label="Owner instructions for the agent (optional)"
            hint="Promos, sizing guidance, etiquette — the AI follows these"
          >
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              maxLength={2000}
              className={inputClass}
              placeholder="e.g. Always mention that delivery inside Dhaka takes one day. Never offer free delivery."
            />
          </Field>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Launch summary
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <span>
                <span className="font-medium text-zinc-800">Business:</span> {preset.label}
              </span>
              <span>
                <span className="font-medium text-zinc-800">Template:</span>{' '}
                {STOREFRONT_TEMPLATES[templateId].label}
              </span>
              <span>
                <span className="font-medium text-zinc-800">Categories:</span>{' '}
                {preset.categories.length}
              </span>
              <span>
                <span className="font-medium text-zinc-800">Delivery zones:</span>{' '}
                {zones.filter((z) => z.name.trim()).length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep(3)} icon={<Icon.ArrowLeft size={15} />}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              {error ? <ErrorNote message={error} /> : null}
              <Button
                onClick={() => void create()}
                disabled={busy}
                size="lg"
                icon={<Icon.Spark size={16} />}
              >
                {busy ? 'Launching your store…' : 'Launch store'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step < 4 && error ? <ErrorNote message={error} /> : null}
    </div>
  );
}
