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
  const catNames = ['T-Shirt', 'Saree', 'Panjabi', 'Kids', 'Shirt'];
  const cats = await rest(
    '/rest/v1/categories',
    'POST',
    catNames.map((name) => ({ shop_id: shopRow.id, name })),
  );
  const catRows = Array.isArray(cats.json) ? cats.json : [];
  const catId = Object.fromEntries(catRows.map((c) => [c.name, c.id]));
  console.log(`✓ ${catRows.length} categories`);

  const img = (seed, w = 800, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

  // 5. Products + variants --------------------------------------------------
  const products = [
    {
      name: 'লাল কটন টি-শার্ট (Red Cotton T-Shirt)',
      description:
        '100% কটন, গরমের জন্য পারফেক্ট। রঙ ফেড হয় না। (100% cotton mid-weight tee, does not fade.)',
      category_id: catId['T-Shirt'],
      price: 650,
      floor_price: 500,
      images: [img('red-tee')],
      variants: [
        { size: 'S', color: 'Red', stock: 10, price_override: null },
        { size: 'M', color: 'Red', stock: 8, price_override: null },
        { size: 'L', color: 'Red', stock: 12, price_override: 700 },
      ],
    },
    {
      name: 'Black Oversized T-Shirt',
      description: 'Street-style oversized fit, thick 220 GSM. সাইজ বড় দেখতে পাবেন বড় বেছে নিন।',
      category_id: catId['T-Shirt'],
      price: 750,
      floor_price: 600,
      images: [img('black-tee')],
      variants: [
        { size: 'M', color: 'Black', stock: 5, price_override: null },
        { size: 'XL', color: 'Black', stock: 3, price_override: 820 },
      ],
    },
    {
      name: 'জামদানি শাড়ি (Jamdani Saree)',
      description: 'আসল জামদানি বুটিদার শাড়ি, ব্লাউজ পিস সহ। বিয়ে ও উৎসবের জন্য একদম পারফেক্ট।',
      category_id: catId['Saree'],
      price: 3500,
      floor_price: 2800,
      images: [img('jamdani-saree'), img('jamdani-detail')],
      variants: [{ color: 'Merlot', stock: 4, price_override: null }],
    },
    {
      name: 'Half Silk Saree',
      description: 'হাফ সিল্ক শাড়ি, অফিস-ক্লাসের জন্য হালকা ও আরামদায়ক।',
      category_id: catId['Saree'],
      price: 1800,
      floor_price: 1500,
      images: [img('half-silk-saree')],
      variants: [
        { color: 'Teal', stock: 6, price_override: null },
        { color: 'Pink', stock: 4, price_override: null },
      ],
    },
    {
      name: 'White Panjabi',
      description: 'মালমল কটন পাঞ্জাবি, এমব্রয়ডারি কলার। ঈদ-জুম্মার জন্য ভালো।',
      category_id: catId['Panjabi'],
      price: 1200,
      floor_price: 1000,
      images: [img('white-panjabi')],
      variants: [
        { size: 'M', color: 'White', stock: 7, price_override: null },
        { size: 'L', color: 'White', stock: 7, price_override: null },
      ],
    },
    {
      name: 'Kids Printed Tee',
      description:
        'খাটুনি কটন বাচ্চাদের টি-শার্ট, প্রিন্ট সুন্দর ও টিকে থাকে। (Soft combed-cotton kids tee with a durable print.)',
      category_id: catId['Kids'],
      price: 450,
      floor_price: 350,
      images: [img('kids-tee')],
      variants: [
        { size: '2-3Y', color: 'Yellow', stock: 9, price_override: null },
        { size: '4-5Y', color: 'Yellow', stock: 9, price_override: null },
      ],
    },
    {
      name: 'Blue Denim Shirt',
      description: 'Slim-fit ডেনিম শার্ট, ডাবল পকেট। হারাশ নেই, লং লাস্টিং কালার।',
      category_id: catId['Shirt'],
      price: 1450,
      floor_price: 1200,
      images: [img('denim-shirt')],
      variants: [
        { size: 'M', color: 'Wash Blue', stock: 4, price_override: null },
        { size: 'L', color: 'Wash Blue', stock: 4, price_override: null },
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
