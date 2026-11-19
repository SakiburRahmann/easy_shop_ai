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
const SLUG = 'northline-home';

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
    name: 'Northline Home',
    slug: SLUG,
    business_type: 'home',
    description: 'Thoughtful essentials for a more comfortable home.',
    template_id: 'classic',
    theme: { primaryColor: '#2f5bf0' },
    contact: {
      phone: '+1 (415) 555-0134',
      email: DEMO_EMAIL,
      facebook: 'https://facebook.com/northlinehome',
    },
    delivery_rules: {
      zones: [
        { name: 'Standard delivery', charge: 9, etaDays: 4 },
        { name: 'Express delivery', charge: 19, etaDays: 2 },
        { name: 'Remote areas', charge: 29, etaDays: 7 },
      ],
    },
    policies: {
      returnPolicy: '30-day returns on unused items in their original packaging.',
      notes: 'Packed with care and shipped from our studio.',
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
    languages: ['en'],
    max_discount_pct: 15,
    extra_instructions:
      'We ship across the country. Cash on delivery is the only payment method. Always answer in English.',
  });
  console.log('✓ ai settings');

  // 4. Categories -----------------------------------------------------------
  const catNames = ['Home & Living', 'Kitchen', 'Decor', 'Textiles'];
  const cats = await rest(
    '/rest/v1/categories',
    'POST',
    catNames.map((name) => ({ shop_id: shopRow.id, name })),
  );
  const catRows = Array.isArray(cats.json) ? cats.json : [];
  const catId = Object.fromEntries(catRows.map((c) => [c.name, c.id]));
  console.log(`✓ ${catRows.length} categories`);

  // Verified Unsplash photography (see apps/web/src/components/storefront/
  // image-library.ts). Product cards show the item itself.
  const img = (id, w = 1000, h = 800) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

  // 5. Products + variants --------------------------------------------------
  const products = [
    {
      name: 'Linen Throw Blanket',
      description:
        'A soft stonewashed linen throw with a hand-knotted fringe. Light enough for summer evenings, warm enough for winter sofas.',
      category_id: catId['Textiles'],
      price: 49,
      floor_price: 38,
      images: [img('1600369672770-985fd30004eb')],
      variants: [
        { color: 'Natural', stock: 18 },
        { color: 'Charcoal', stock: 9 },
        { color: 'Sage', stock: 7 },
      ],
    },
    {
      name: 'Ceramic Mug Set',
      description:
        'Four hand-glazed stoneware mugs with a matte finish. Dishwasher safe, made for slow mornings.',
      category_id: catId['Kitchen'],
      price: 28,
      floor_price: 21,
      images: [img('1616241673111-508b4662c707')],
      variants: [
        { color: 'White', stock: 24 },
        { color: 'Sand', stock: 12 },
      ],
    },
    {
      name: 'Wooden Cutting Board',
      description:
        'Solid oak serving board with a juice groove and a soft oiled finish. Use it to prep, serve and display.',
      category_id: catId['Kitchen'],
      price: 36,
      floor_price: 27,
      images: [img('1617695615794-a5abcece0f48')],
      variants: [{ color: 'Natural', stock: 15 }],
    },
    {
      name: 'Stone Planter',
      description:
        'A weighty, hand-cast planter in a warm stone finish, with a drainage hole and a matching saucer.',
      category_id: catId['Decor'],
      price: 32,
      floor_price: 24,
      images: [img('1562351757-66f3589f30cf')],
      variants: [
        { color: 'Stone', stock: 11 },
        { color: 'Charcoal', stock: 6 },
      ],
    },
    {
      name: 'Table Lamp',
      description:
        'A linen-shade table lamp on a slim wooden base. Warm, diffused light for a bedside or reading corner.',
      category_id: catId['Home & Living'],
      price: 89,
      floor_price: 72,
      images: [img('1517991104123-1d56a6e81ed9')],
      variants: [
        { color: 'Ivory', stock: 8 },
        { color: 'Sage', stock: 5 },
      ],
    },
    {
      name: 'Lumbar Cushion',
      description:
        'A textured cotton lumbar cushion with a feather-soft insert. Layered neutral tones for the sofa or bed.',
      category_id: catId['Textiles'],
      price: 82,
      floor_price: 64,
      images: [img('1611489704164-6f73c62bd810')],
      variants: [
        { color: 'Sand', stock: 14 },
        { color: 'Olive', stock: 10 },
      ],
    },
    {
      name: 'Eucalyptus Stem Set',
      description:
        'Faux eucalyptus stems with a natural drape, ready for a tall vase. No watering, no fading.',
      category_id: catId['Decor'],
      price: 14,
      floor_price: 9,
      images: [img('1574441038618-2e3beb562baf')],
      variants: [{ color: 'Natural', stock: 30 }],
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
        size: null,
        color: v.color ?? null,
        stock: v.stock,
        price_override: null,
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
