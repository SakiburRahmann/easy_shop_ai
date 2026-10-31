'use client';

/** Shop settings (profile, contact, theme) and AI assistant settings. */
import { useEffect, useState, type FormEvent } from 'react';
import {
  aiSettingsSchema,
  aiSettingsUpdateInputSchema,
  type AiSettings,
  shopSchema,
  type Shop,
  shopUpdateInputSchema,
  uploadResultSchema,
} from '@easyshop/shared';
import { Badge, Button, ErrorNote, Field, OkNote, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
import type { Api } from './Dashboard';

export default function SettingsTab({
  auth,
  shop,
  onShopChange,
}: {
  auth: Api;
  shop: Shop;
  onShopChange: (shop: Shop) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ShopSettings auth={auth} shop={shop} onShopChange={onShopChange} />
      <AiSettingsCard auth={auth} shop={shop} />
    </div>
  );
}

function ShopSettings({
  auth,
  shop,
  onShopChange,
}: {
  auth: Api;
  shop: Shop;
  onShopChange: (shop: Shop) => void;
}) {
  const [logoUrl, setLogoUrl] = useState(shop.logoUrl ?? '');
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description ?? '');
  const [phone, setPhone] = useState(shop.contact.phone ?? '');
  const [email, setEmail] = useState(shop.contact.email ?? '');
  const [facebook, setFacebook] = useState(shop.contact.facebook ?? '');
  const [color, setColor] = useState(shop.theme.primaryColor ?? '#059669');
  const [returnPolicy, setReturnPolicy] = useState(shop.policies.returnPolicy ?? '');
  const [notes, setNotes] = useState(shop.policies.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const input = shopUpdateInputSchema.safeParse({
      name,
      description,
      contact: {
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(facebook ? { facebook } : {}),
      },
      theme: { primaryColor: color },
      policies: {
        ...(returnPolicy ? { returnPolicy } : {}),
        ...(notes ? { notes } : {}),
      },
      logoUrl: logoUrl || null,
    });
    if (!input.success) {
      setErr(input.error.issues[0]?.message ?? 'Invalid settings');
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      onShopChange(
        shopSchema.parse(
          await auth<unknown>(`/shops/${shop.id}`, { method: 'PATCH', body: input.data }),
        ),
      );
      setOk('Saved.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const dataBase64 = btoa(
        Array.from(new Uint8Array(await file.arrayBuffer()), (b) => String.fromCharCode(b)).join(
          '',
        ),
      );
      const res = uploadResultSchema.parse(
        await auth<unknown>('/uploads', {
          body: { filename: file.name, contentType: file.type, dataBase64 },
        }),
      );
      setLogoUrl(res.url);
      setOk('Logo uploaded — press “Save shop” to apply it.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Upload failed (image must be < 4.5 MB)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon.Palette size={15} />
          </span>
          Shop
        </h2>
        {shop.deliveryRules.zones.length ? (
          <div className="flex flex-wrap gap-1">
            {shop.deliveryRules.zones.map((z) => (
              <Badge key={z.name} icon={<Icon.Truck size={11} />}>
                {z.name} · {z.charge} ৳ · {z.etaDays}d
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shop name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Storefront URL">
          <div className="flex gap-2">
            <input
              value={`/s?shop=${shop.slug}`}
              readOnly
              className={`${inputClass} flex-1 bg-zinc-50 text-zinc-500`}
            />
            <a
              href={`/s?shop=${shop.slug}`}
              target="_blank"
              rel="noopener"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            >
              <Icon.Eye size={14} />
              View
            </a>
          </div>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={1000}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Contact phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Contact email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Facebook page">
          <input
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo" hint="Shows in the storefront header (square works best)">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-zinc-300">
              {logoUrl ? (
                <img src={logoUrl} alt="Shop logo" className="h-full w-full object-cover" />
              ) : (
                <Icon.Image size={18} />
              )}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50">
              <Icon.Upload size={14} className="text-zinc-400" />
              Upload
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])}
              />
            </label>
            {logoUrl ? (
              <button
                type="button"
                onClick={() => setLogoUrl('')}
                className="text-xs text-zinc-400 underline hover:text-red-600"
              >
                remove
              </button>
            ) : null}
          </div>
        </Field>
        <Field label="Theme color" hint="Storefront header + chat accent">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-zinc-300"
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
        </Field>
      </div>
      <Field label="Storefront notes">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          className={inputClass}
        />
      </Field>
      <Field label="Return policy">
        <textarea
          value={returnPolicy}
          onChange={(e) => setReturnPolicy(e.target.value)}
          rows={2}
          maxLength={2000}
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save shop'}
        </Button>
        <OkNote message={ok} />
      </div>
      <ErrorNote message={err} />
    </form>
  );
}

function AiSettingsCard({ auth, shop }: { auth: Api; shop: Shop }) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [tone, setTone] = useState<'friendly' | 'formal' | 'playful'>('friendly');
  const [bn, setBn] = useState(true);
  const [en, setEn] = useState(true);
  const [discount, setDiscount] = useState(10);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth<unknown>(`/shops/${shop.id}/ai-settings`)
      .then((raw) => {
        const parsed = aiSettingsSchema.safeParse(raw);
        if (!parsed.success || cancelled) return;
        setSettings(parsed.data);
        setTone(parsed.data.tone);
        setBn(parsed.data.languages.includes('bn'));
        setEn(parsed.data.languages.includes('en'));
        setDiscount(parsed.data.maxDiscountPct);
        setExtra(parsed.data.extraInstructions ?? '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth, shop.id]);

  const save = async () => {
    const languages = [bn ? 'bn' : '', en ? 'en' : ''].filter(Boolean);
    if (languages.length === 0) {
      setErr('Pick at least one language');
      return;
    }
    const input = aiSettingsUpdateInputSchema.safeParse({
      tone,
      languages,
      maxDiscountPct: discount,
      ...(extra ? { extraInstructions: extra } : {}),
    });
    if (!input.success) {
      setErr(input.error.issues[0]?.message ?? 'Invalid AI settings');
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      setSettings(
        aiSettingsSchema.parse(
          await auth<unknown>(`/shops/${shop.id}/ai-settings`, {
            method: 'PATCH',
            body: input.data,
          }),
        ),
      );
      setOk('AI settings saved.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon.Spark size={15} />
          </span>
          AI assistant
        </h2>
        <Badge tone={settings ? 'green' : 'amber'}>{settings ? 'initialized' : 'loading…'}</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tone" hint="How it talks to customers">
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
        <Field label="Max bargaining discount" hint="Server-enforced cap on negotiated prices">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={90}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
            />
            <span className="w-12 text-right text-sm font-semibold">{discount}%</span>
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
        label="Extra instructions"
        hint="Anything the assistant should always follow (promos, sizes, etiquette)"
      >
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={3}
          maxLength={2000}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save AI settings'}
        </Button>
        <OkNote message={ok} />
      </div>
      <ErrorNote message={err} />
    </div>
  );
}
