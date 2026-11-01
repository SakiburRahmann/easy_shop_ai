'use client';

/** Product management: list, create (with variants), toggle, delete, image upload. */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  type Category,
  type ProductAdmin,
  type ProductInput,
  type Shop,
  type Storefront,
  type VariantInput,
  productAdminSchema,
  storefrontSchema,
  uploadResultSchema,
} from '@easyshop/shared';
import { api, taka } from '@/lib/api';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  OkNote,
  Spinner,
  inputClass,
} from '@/components/ui';
import { Icon } from '@/lib/icons';
import type { Api } from './Dashboard';

export default function ProductsTab({ auth, shop }: { auth: Api; shop: Shop }) {
  const [products, setProducts] = useState<ProductAdmin[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (): Promise<{
    products: ProductAdmin[];
    categories: Category[];
  }> => {
    const list = await auth<unknown[]>(`/shops/${shop.id}/products?limit=50`);
    // Categories ride on the public storefront payload (no auth needed).
    const sf = await api<unknown>(`/s/${shop.slug}`).catch(() => null);
    const parsed = sf ? storefrontSchema.safeParse(sf) : null;
    return {
      products: list.map((p) => productAdminSchema.parse(p)),
      categories: parsed?.success ? (parsed.data as Storefront).categories : [],
    };
  }, [auth, shop.id, shop.slug]);

  /** Manual refresh (invoked from event handlers, never directly in an effect). */
  const reload = useCallback(
    () =>
      loadAll()
        .then((r) => {
          setError(null);
          setProducts(r.products);
          setCategories(r.categories);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load products')),
    [loadAll],
  );

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((r) => {
        if (cancelled) return;
        setProducts(r.products);
        setCategories(r.categories);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load products');
      });
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const createProduct = (p: ProductAdmin) => {
    setProducts((prev) => [...(prev ?? []), p]);
    setCreateOpen(false);
    setNotice(`Product "${p.name}" created.`);
    void reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Products ({products?.length ?? 0})</h2>
        <Button onClick={() => setCreateOpen(true)} icon={<Icon.Plus size={15} />}>
          New product
        </Button>
      </div>
      <ErrorNote message={error} />
      <OkNote message={notice} />

      {products === null ? (
        <Spinner />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          body="Create your first product — inventory, floor price and all. The AI assistant will then find it in customer chats."
          action={
            <Button onClick={() => setCreateOpen(true)} icon={<Icon.Plus size={15} />}>
              New product
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              auth={auth}
              onDone={() => void reload()}
              categories={categories}
            />
          ))}
        </ul>
      )}

      <CategoriesManager
        auth={auth}
        shop={shop}
        categories={categories}
        onReload={() => void reload()}
      />

      <CreateProductModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        auth={auth}
        shop={shop}
        categories={categories}
        onCreated={createProduct}
      />
    </div>
  );
}

/* ───────────────────────── categories manager ─────────────────────────── */

function CategoriesManager({
  auth,
  shop,
  categories,
  onReload,
}: {
  auth: Api;
  shop: Shop;
  categories: Category[];
  onReload: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await auth(`/shops/${shop.id}/categories`, { body: { name: trimmed } });
      setName('');
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add category');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, label: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await auth(`/categories/${id}`, { method: 'DELETE' });
      onReload();
    } catch {
      setErr(`Could not delete “${label}” — products may still use it.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
          <Icon.Tag size={14} className="text-brand-600" />
          Categories
        </span>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-3 pr-1.5 text-xs font-medium text-zinc-700"
            >
              {c.name}
              <button
                type="button"
                aria-label={`Delete category ${c.name}`}
                onClick={() => void remove(c.id, c.name)}
                disabled={busy}
                className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-red-600 disabled:opacity-40"
              >
                <Icon.Trash size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="Add a category…"
            maxLength={40}
            className="h-8 w-40 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
          <Button
            size="sm"
            variant="soft"
            onClick={() => void add()}
            disabled={busy || !name.trim()}
          >
            Add
          </Button>
        </div>
      </div>
      <ErrorNote message={err} />
    </div>
  );
}

/* ─────────────────────────── product row ─────────────────────────────── */

function ProductRow({
  product,
  auth,
  onDone,
}: {
  product: ProductAdmin;
  auth: Api;
  onDone: () => void;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const stock = product.variants.length
    ? product.variants.reduce((s, v) => s + v.stock, 0)
    : product.stock;

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await auth(`/products/${product.id}`, { method: 'PATCH', body });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete "${product.name}"? Products with past orders are hidden instead of removed.`,
      )
    )
      return;
    setBusy(true);
    try {
      await auth(`/products/${product.id}`, { method: 'DELETE' });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white transition hover:border-zinc-300 hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Icon.Package size={18} />
            </div>
          )}
        </div>
        <div className="flex min-w-40 flex-1 flex-col">
          <span className="text-sm font-medium">{product.name}</span>
          <span className="text-xs text-zinc-500">
            <span className="font-semibold text-zinc-700">{taka(product.price)}</span> · floor{' '}
            {taka(product.floorPrice)} · stock {stock}
          </span>
        </div>
        {product.active ? (
          <Badge tone="green" icon={<Icon.Check size={11} />}>
            live
          </Badge>
        ) : (
          <Badge tone="amber" icon={<Icon.Eye size={11} />}>
            hidden
          </Badge>
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void patch({ active: !product.active })}
            disabled={busy}
          >
            {product.active ? 'Hide' : 'Show'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Manage'}
          </Button>
          <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>
      {open ? <ProductDetails product={product} auth={auth} onDone={onDone} /> : null}
    </li>
  );
}

function ProductDetails({
  product,
  auth,
  onDone,
}: {
  product: ProductAdmin;
  auth: Api;
  onDone: () => void;
}) {
  const [description, setDescription] = useState(product.description ?? '');
  const [price, setPrice] = useState(String(product.price));
  const [floor, setFloor] = useState(String(product.floorPrice));
  const [stock, setStock] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState({ size: '', color: '', stock: '1' });

  if (!product) return null;
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await auth(`/products/${product.id}`, {
        method: 'PATCH',
        body: {
          description,
          price: Number(price),
          floorPrice: Number(floor),
          stock: Number(stock),
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
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
      // uploads endpoint POST returns { url } — PATCH product images here.
      await auth(`/products/${product.id}`, {
        method: 'PATCH',
        body: { images: [...product.images, res.url].slice(0, 8) },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed (image must be < 4.5 MB)');
    } finally {
      setBusy(false);
    }
  };

  const addVariant = async () => {
    setBusy(true);
    setErr(null);
    const input: VariantInput = {
      ...(adding.size ? { size: adding.size } : {}),
      ...(adding.color ? { color: adding.color } : {}),
      stock: Number(adding.stock) || 0,
    };
    try {
      await auth(`/products/${product.id}/variants`, { body: input });
      setAdding({ size: '', color: '', stock: '1' });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Variant failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteVariant = async (id: string) => {
    setBusy(true);
    try {
      await auth(`/variants/${id}`, { method: 'DELETE' });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const updateVariantStock = async (id: string, stock: number) => {
    setBusy(true);
    try {
      await auth(`/variants/${id}`, { method: 'PATCH', body: { stock: Math.max(0, stock) } });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50 p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (৳)">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            className={inputClass}
          />
        </Field>
        <Field label="Floor price (৳)" hint="Secret bargaining limit — shown to nobody">
          <input
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            type="number"
            min={0}
            className={inputClass}
          />
        </Field>
        <Field
          label="Stock"
          hint={product.variants.length ? 'Managed per variant below' : 'Units customers can order'}
        >
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            type="number"
            min={0}
            className={inputClass}
            disabled={product.variants.length > 0}
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-2">
        <Button onClick={save} disabled={busy}>
          Save changes
        </Button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50">
          <Icon.Upload size={14} className="text-zinc-400" />
          Upload image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
        </label>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
          VARIANTS
        </div>
        <ul className="flex flex-col">
          {product.variants.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-400">
              No variants — the product is sold without size/color options.
            </li>
          ) : (
            product.variants.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 border-b border-zinc-50 px-3 py-2 last:border-0"
              >
                <span className="min-w-28 flex-1 text-xs">
                  {[v.size, v.color].filter(Boolean).join(' · ') || '—'}
                </span>
                <input
                  type="number"
                  defaultValue={v.stock}
                  min={0}
                  className={`${inputClass} w-20`}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n !== v.stock && n >= 0) void updateVariantStock(v.id, n);
                  }}
                />
                {v.priceOverride !== null && v.priceOverride !== undefined ? (
                  <Badge>{taka(v.priceOverride)}</Badge>
                ) : null}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void deleteVariant(v.id)}
                  disabled={busy}
                  aria-label="Delete variant"
                >
                  <Icon.Trash size={13} />
                </Button>
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 p-2">
          <input
            placeholder="Size"
            value={adding.size}
            onChange={(e) => setAdding((a) => ({ ...a, size: e.target.value }))}
            className={`${inputClass} w-24`}
          />
          <input
            placeholder="Color"
            value={adding.color}
            onChange={(e) => setAdding((a) => ({ ...a, color: e.target.value }))}
            className={`${inputClass} w-24`}
          />
          <input
            placeholder="Stock"
            type="number"
            min={0}
            value={adding.stock}
            onChange={(e) => setAdding((a) => ({ ...a, stock: e.target.value }))}
            className={`${inputClass} w-20`}
          />
          <Button onClick={addVariant} disabled={busy}>
            Add variant
          </Button>
        </div>
      </div>

      <ErrorNote message={err} />
    </div>
  );
}

/* ──────────────────────── create product modal ─────────────────────────── */

function CreateProductModal({
  open,
  onClose,
  auth,
  shop,
  categories,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  auth: Api;
  shop: Shop;
  categories: Category[];
  onCreated: (p: ProductAdmin) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    price: '',
    floor: '',
    stock: '10',
    description: '',
    categoryId: '',
  });
  const [variants, setVariants] = useState<Array<VariantInput>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input: ProductInput = {
      name: form.name,
      price: Number(form.price),
      ...(form.floor ? { floorPrice: Number(form.floor) } : {}),
      stock: Number(form.stock) || 0,
      ...(form.description ? { description: form.description } : {}),
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
      active: true,
      ...(variants.length ? { variants } : {}),
    };
    setBusy(true);
    setErr(null);
    try {
      onCreated(
        productAdminSchema.parse(
          await auth<unknown>(`/shops/${shop.id}/products`, { body: input }),
        ),
      );
      setForm({ name: '', price: '', floor: '', stock: '10', description: '', categoryId: '' });
      setVariants([]);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New product" wide>
      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
            required
            maxLength={120}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Price (৳)">
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Floor price (৳)" hint="Offers below this are auto-rejected by the server">
            <input
              type="number"
              min={0}
              value={form.floor}
              onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field
            label="Stock"
            hint={variants.length ? 'Ignored — variants track stock' : 'Units available'}
          >
            <input
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              className={inputClass}
              disabled={variants.length > 0}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            className={inputClass}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            maxLength={2000}
            className={inputClass}
          />
        </Field>

        <div className="rounded-lg border border-zinc-200 p-3">
          <div className="mb-2 text-xs font-semibold text-zinc-500">VARIANTS (optional)</div>
          {variants.length ? (
            <ul className="mb-2 flex flex-col gap-1">
              {variants.map((v, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="flex-1">
                    {[v.size, v.color].filter(Boolean).join(' · ') || '—'} … stock {v.stock}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove variant row"
                    className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-600"
                    onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
                  >
                    <Icon.X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <VariantQuickAdd onAdd={(v) => setVariants((vs) => [...vs, v])} />
        </div>

        <ErrorNote message={err} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating…' : 'Create product'}
        </Button>
      </form>
    </Modal>
  );
}

function VariantQuickAdd({ onAdd }: { onAdd: (v: VariantInput) => void }) {
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [stock, setStock] = useState('1');
  const add = () => {
    onAdd({
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
      stock: Math.max(0, Number(stock) || 0),
    });
    setSize('');
    setColor('');
    setStock('1');
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        placeholder="Size"
        value={size}
        onChange={(e) => setSize(e.target.value)}
        className={`${inputClass} w-24`}
      />
      <input
        placeholder="Color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className={`${inputClass} w-24`}
      />
      <input
        placeholder="Stock"
        type="number"
        min={0}
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        className={`${inputClass} w-20`}
      />
      <Button variant="ghost" onClick={add}>
        Add row
      </Button>
    </div>
  );
}
