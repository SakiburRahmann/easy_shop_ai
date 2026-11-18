/**
 * Seeds a demo seller, shop, categories and products against the live
 * Supabase project. Idempotent: skips when the demo shop already exists.
 *
 * Run: pnpm --filter @easyshop/api db:seed
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

function readEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const value = t
      .slice(eq + 1)
      .trim()
      .replace(/^["'](.*)["']$/, '$1');
    if (!(key in out)) out[key] = value;
  }
  return out;
}

const env = { ...process.env, ...readEnvFile(join(repoRoot, '.env.local')) };
const SUPABASE_URL = (env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SECRET = env.SUPABASE_SECRET_KEY;
const DEMO_EMAIL = 'demo@easyshopai.dev';
const DEMO_PASSWORD = 'easyshop-demo1';
const SLUG = 'rahman-fashion';

if (!SUPABASE_URL || !SECRET) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

async function rest(path, method, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      ...(body ? { Prefer: 'return=representation' } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

async function main() {
  // 1. Demo seller ----------------------------------------------------------
  const created = await rest('/auth/v1/admin/users', 'POST', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Demo Seller', role: 'seller' },
  });
  if (created.status === 200 || created.status === 201) {
    console.log(`✓ demo seller created (${DEMO_EMAIL})`);
  } else if (
    created.json?.msg?.includes('already') ||
    created.json?.error_description?.includes('already') ||
    created.status === 422
  ) {
    console.log('= demo seller already exists');
  } else {
    console.error('x seller creation failed', created.status, created.text.slice(0, 300));
    process.exit(1);
  }

  const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SECRET },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const loginJson = await login.json().catch(() => null);
  const sellerId = loginJson?.user?.id;
  if (!sellerId) {
    console.error(
      'x could not resolve demo seller id',
      login.status,
      JSON.stringify(loginJson).slice(0, 300),
    );
    process.exit(1);
  }
  console.log(`✓ demo seller id ${sellerId}`);

  // 2. Shop -----------------------------------------------------------------
  const existing = await rest(`/rest/v1/shops?slug=eq.${SLUG}&select=*`);
  if (existing.json?.length) {
    console.log(`= shop ${SLUG} already seeded — done`);
    return;
  }

  const shop = await rest('/rest/v1/shops', 'POST', {
    owner_id: sellerId,
    name: 'Rahman Fashion',
    slug: SLUG,
    description: 'Server-confirmed demo shop seeded by EasyShopAI.',
    template_id: 'classic',
    theme: { primaryColor: '#0EA5E9' },
    contact: {
      phone: '+8801700000000',
      email: DEMO_EMAIL,
      facebook: 'https://facebook.com/rahmanfashion',
    },
    delivery_rules: {
      zones: [
        { name: 'Dhaka City', charge: 60, etaDays: 1 },
        { name: 'Chattogram', charge: 120, etaDays: 3 },
        { name: 'Outside Dhaka', charge: 130, etaDays: 3 },
      ],
    },
    policies: {
      returnPolicy:
        '7 দিনের মধ্যে অব্যবহৃত পণ্য রসিদসহ ফেরত দেওয়া যাবে। (7-day return for unused items with receipt.)',
      notes: 'We pack with care and ship nationwide.',
    },
  });
  const shopRow = Array.isArray(shop.json) ? shop.json[0] : null;
  if (!shopRow) {
    console.error('x shop insert failed', shop.status, shop.text.slice(0, 300));
    process.exit(1);
  }
  console.log(`✓ shop ${SLUG} (${shopRow.id})`);

  // 3. AI settings ----------------------------------------------------------
  await rest('/rest/v1/ai_settings', 'POST', {
    shop_id: shopRow.id,
    tone: 'friendly',
    languages: ['bn', 'en'],
    max_discount_pct: 15,
    extra_instructions:
      'আমরা সারা দেশে ডেলিভারি দিই। COD-ই আপাতত একমাত্র পেমেন্ট। বাংলায় আলাপ করলে স্বাভাবিক বাংলায় উত্তর দিই।',
  });
  console.log('✓ ai settings');

  // 4. Categories -----------------------------------------------------------
  const catNames = ['T-Shirts', 'Hoodies', 'Trousers', 'Shoes', 'Outerwear', 'Dresses'];
  const cats = await rest(
    '/rest/v1/categories',
    'POST',
    catNames.map((name) => ({ shop_id: shopRow.id, name })),
  );
  const catRows = Array.isArray(cats.json) ? cats.json : [];
  const catId = Object.fromEntries(catRows.map((c) => [c.name, c.id]));
  console.log(`✓ ${catRows.length} categories`);

  // Verified Unsplash photography (see apps/web/src/components/storefront/
  // image-library.ts). Product cards must show the item itself, so each demo
  // product carries an image of the garment it describes.
  const img = (id, w = 900, h = 1100) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

  // 5. Products + variants --------------------------------------------------
  const products = [
    {
      name: 'হেভিওয়েট কটন টি-শার্ট (Heavyweight Cotton Tee)',
      description:
        'মোটা ২২০ জিএসএম কটন, ধোয়ার পরেও রঙ ফেড হয় না। (220 GSM combed cotton, stays true after washing.)',
      category_id: catId['T-Shirts'],
      price: 1150,
      floor_price: 900,
      images: [img('1521572163474-6864f9cf17ab')],
      variants: [
        { size: 'S', color: 'White', stock: 10, price_override: null },
        { size: 'M', color: 'White', stock: 8, price_override: null },
        { size: 'L', color: 'White', stock: 12, price_override: 1250 },
      ],
    },
    {
      name: 'ব্রাশড ফ্লিস হুডি (Brushed Fleece Hoodie)',
      description:
        'ভেতরে ব্রাশড ফ্লিস, ঠান্ডায় আরামদায়ক। (Heavy brushed fleece hoodie, relaxed fit.)',
      category_id: catId['Hoodies'],
      price: 2400,
      floor_price: 1900,
      images: [img('1517841905240-472988babdf9')],
      variants: [
        { size: 'M', color: 'Pale Blue', stock: 5, price_override: null },
        { size: 'XL', color: 'Pale Blue', stock: 3, price_override: 2600 },
      ],
    },
    {
      name: 'সিল্ক স্লিপ ড্রেস (Silk Slip Dress)',
      description: 'হালকা সিল্ক, বায়াস কাট। (Bias-cut silk slip dress with adjustable straps.)',
      category_id: catId['Dresses'],
      price: 4300,
      floor_price: 3500,
      images: [img('1566174053879-31528523f8ae')],
      variants: [{ size: 'M', color: 'Burgundy', stock: 4, price_override: null }],
    },
    {
      name: 'উল ব্লেন্ড ওভারকোট (Wool Blend Overcoat)',
      description:
        'দীর্ঘ উল ব্লেন্ড কোট, শীতের শহরের জন্য। (Longline wool blend overcoat, structured shoulder.)',
      category_id: catId['Outerwear'],
      price: 6800,
      floor_price: 5400,
      images: [img('1485968579580-b6d095142e6e')],
      variants: [
        { size: 'S', color: 'Plaid', stock: 6, price_override: null },
        { size: 'M', color: 'Plaid', stock: 4, price_override: null },
      ],
    },
    {
      name: 'সেলভেজ ডেনিম জ্যাকেট (Selvedge Denim Jacket)',
      description:
        'মোটা সেলভেজ ডেনিম, ক্রমশ নিজের মতো ফেড হবে। (Rigid selvedge denim jacket, fades with wear.)',
      category_id: catId['Outerwear'],
      price: 5200,
      floor_price: 4200,
      images: [img('1611312449408-fcece27cdbb7')],
      variants: [
        { size: 'M', color: 'Indigo', stock: 7, price_override: null },
        { size: 'L', color: 'Indigo', stock: 7, price_override: null },
      ],
    },
    {
      name: 'টেপার্ড কার্গো ট্রাউজার (Tapered Cargo Trouser)',
      description: 'কটন টুইল কার্গো, ছয়টি পকেট। (Cotton twill cargo with a clean tapered leg.)',
      category_id: catId['Trousers'],
      price: 2850,
      floor_price: 2300,
      images: [img('1548883354-7622d03aca27')],
      variants: [
        { size: '30', color: 'Charcoal', stock: 9, price_override: null },
        { size: '32', color: 'Charcoal', stock: 9, price_override: null },
      ],
    },
    {
      name: 'সুয়েড লো-টপ স্নিকার (Suede Low-Top Sneaker)',
      description: 'সুয়েড আপার, কুশনড ইনসোল। (Suede upper on a cupsole, padded collar.)',
      category_id: catId['Shoes'],
      price: 3900,
      floor_price: 3100,
      images: [img('1549298916-b41d501d3772')],
      variants: [
        { size: '41', color: 'Tan', stock: 4, price_override: null },
        { size: '42', color: 'Tan', stock: 4, price_override: null },
      ],
    },
  ];

  const prods = await rest(
    '/rest/v1/products',
    'POST',
    products.map((p) => ({
      shop_id: shopRow.id,
      category_id: p.category_id ?? null,
      name: p.name,
      description: p.description,
      price: p.price.toFixed(2),
      floor_price: p.floor_price.toFixed(2),
      images: p.images,
      active: true,
    })),
  );
  const prodRows = Array.isArray(prods.json) ? prods.json : [];
  if (prodRows.length !== products.length) {
    console.error('x product inserts failed', prods.status, prods.text.slice(0, 400));
    process.exit(1);
  }
  console.log(`✓ ${prodRows.length} products`);

  const variantRows = [];
  products.forEach((p, i) => {
    for (const v of p.variants) {
      variantRows.push({
        product_id: prodRows[i].id,
        size: v.size ?? null,
        color: v.color ?? null,
        stock: v.stock,
        price_override: v.price_override != null ? v.price_override.toFixed(2) : null,
      });
    }
  });
  const vars = await rest('/rest/v1/variants', 'POST', variantRows);
  if (!Array.isArray(vars.json) || vars.json.length !== variantRows.length) {
    console.error('x variant inserts failed', vars.status, vars.text.slice(0, 400));
    process.exit(1);
  }
  console.log(`✓ ${variantRows.length} variants`);

  console.log('\nSeed complete. Demo login:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  shop:     /s/${SLUG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
