#!/usr/bin/env node
/**
 * Builds the AI storefront template catalog from the vendored template
 * archives (`Website_Templates/*.zip`: ~200 templates in Bootstrap, jQuery,
 * plain-HTML and layout stacks).
 *
 * The platform never ships or copies that source code. This script reads each
 * archive, distils ONE metadata record per template (category, stack, style
 * traits, palette, layout hints) and writes `src/data/design-catalog.generated.ts`.
 * That compact catalog is what the generation model chooses from — a lite model
 * can rank 200 structured records reliably, but cannot be handed raw HTML/CSS.
 *
 * Usage:
 *   node scripts/build-design-catalog.mjs
 *   WEBSITE_TEMPLATES_DIR=/path/to/Website_Templates node scripts/build-design-catalog.mjs
 *
 * Output is deterministic (sorted by id, stable key order) so regenerating it
 * produces no diff unless the archives change.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'data', 'design-catalog.generated.ts');
const DIR = process.env.WEBSITE_TEMPLATES_DIR ?? path.join(homedir(), 'code', 'Website_Templates');

/* ───────────────────────────── name → category ───────────────────────── */

/**
 * Keyword sets per library category. Specific categories come first; the
 * classifier scores hits in the template NAME highest, then its directory name,
 * and only then the page title. Raw body text is never used — "mobile-friendly"
 * in a CSS comment must not turn a bakery into an electronics shop.
 */
const CATEGORY_KEYWORDS = [
  [
    'food',
    [
      'food',
      'restaurant',
      'cafe',
      'coffee',
      'cake',
      'bakery',
      'pizza',
      'burger',
      'catering',
      'cooking',
      'recipe',
      'tasty',
      'baker',
      'foodee',
      'foodwagon',
      'cakezone',
      'culinary',
      'menu',
      'dish',
      'icecream',
      'juice',
    ],
  ],
  [
    'beauty',
    [
      'beauty',
      'spa',
      'salon',
      'cosmetic',
      'skincare',
      'makeup',
      'fragrance',
      'hair',
      'parlour',
      'glow',
    ],
  ],
  [
    'fashion',
    [
      'fashion',
      'clothing',
      'cloth',
      'apparel',
      'boutique',
      'saree',
      'panjabi',
      'shoes',
      'sneaker',
      'jewel',
      'wardrobe',
      'couture',
      'moda',
      'dress',
      'malefashion',
      'pillowmart',
    ],
  ],
  [
    'electronics',
    [
      'electronic',
      'gadget',
      'phone',
      'laptop',
      'computer',
      'camera',
      'audio',
      'headphone',
      'drone',
      'hardware',
      'gizmo',
    ],
  ],
  [
    'home',
    [
      'home',
      'furniture',
      'decor',
      'interior',
      'kitchen',
      'garden',
      'plant',
      'flora',
      'sprout',
      'houseware',
    ],
  ],
  ['kids', ['kid', 'toy', 'baby', 'children', 'playground', 'school']],
  ['travel', ['travel', 'tour', 'hotel', 'resort', 'trip', 'holiday', 'flight', 'tourism']],
  ['medical', ['medical', 'clinic', 'doctor', 'dental', 'hospital', 'health', 'medino', 'pharma']],
  ['education', ['education', 'course', 'academy', 'learn', 'university', 'tutor', 'schooling']],
  ['fitness', ['fitness', 'gym', 'yoga', 'sport', 'workout', 'trainer']],
  ['wedding', ['wedding', 'bride', 'invite', 'event']],
  ['portfolio', ['portfolio', 'photograph', 'designer', 'creative', 'freelanc', 'studio']],
  ['realestate', ['realestate', 'realestate', 'property', 'realtor', 'apartment', 'estate']],
  ['automotive', ['automotive', 'garage', 'carmaster', 'vehicle', 'motorbike']],
  ['admin', ['admin', 'dashboard', 'analytics', 'saas', 'applab', 'softy']],
  [
    'business',
    [
      'business',
      'consult',
      'finance',
      'account',
      'corporate',
      'startup',
      'hosting',
      'seo',
      'agency',
    ],
  ],
];

const OUR_TYPE = {
  fashion: 'fashion',
  electronics: 'electronics',
  beauty: 'beauty',
  home: 'home',
  kids: 'kids',
  food: 'groceries',
  groceries: 'groceries',
  travel: 'other',
  medical: 'other',
  education: 'other',
  fitness: 'other',
  wedding: 'other',
  portfolio: 'other',
  realestate: 'other',
  automotive: 'other',
  admin: 'other',
  business: 'other',
};

/** Weighted category match: directory name 2, template name 3, page title 1. */
function categoryOf({ key, name, title }) {
  const haystacks = [
    [key.toLowerCase(), 2],
    [name.toLowerCase(), 3],
    [(title ?? '').toLowerCase(), 1],
  ];
  let best = { category: 'general', score: 0 };
  for (const [category, words] of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const [text, weight] of haystacks) {
      for (const word of words) {
        if (new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text)) score += weight;
      }
    }
    if (score > best.score) best = { category, score };
  }
  return best.category;
}

/* ─────────────────────────────── archive io ──────────────────────────── */

function listZip(zip) {
  return execFileSync('unzip', ['-Z1', zip], { maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\n')
    .filter(Boolean);
}

function readEntry(zip, entry, limit = 400_000) {
  try {
    const buf = execFileSync('unzip', ['-p', zip, entry], {
      maxBuffer: 24 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return buf.subarray(0, limit).toString('utf8');
  } catch {
    return '';
  }
}

/** Groups a flat entry list into templates: `root/id/...` or `root/name/...`. */
function groupTemplates(entries) {
  const dirs = new Map();
  for (const entry of entries) {
    if (entry.endsWith('/')) continue;
    const parts = entry.split('/');
    if (parts.length < 2) continue;
    const key = parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
    if (!dirs.has(key)) dirs.set(key, []);
    dirs.get(key).push(entry);
  }
  return [...dirs.entries()].filter(([, files]) => files.some((f) => /\.html?$/i.test(f)));
}

const SKIP_CSS =
  /bootstrap|font-?awesome|animate|slick|owl|swiper|magnific|jquery|select2|datatable|chosen|themify|icomoon|linearicons|simple-line|flaticon|normalize|reset|style\.css\.map/i;

function bestHtml(files) {
  const html = files.filter(
    (f) => /\.html?$/i.test(f) && !/404|single|blog-single|coming|login|signup|register/i.test(f),
  );
  return (
    html.find((f) => /(^|\/)index\.html?$/i.test(f)) ??
    html.find((f) => /(^|\/)(home|main|default)\.html?$/i.test(f)) ??
    html[0] ??
    ''
  );
}

function bestCss(files) {
  return (
    files
      .filter((f) => /\.css$/i.test(f) && !SKIP_CSS.test(f) && !/\.min\.css$/i.test(f))
      .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0] ??
    files.find((f) => /\.css$/i.test(f) && !SKIP_CSS.test(f)) ??
    ''
  );
}

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;

function paletteOf(...texts) {
  const counts = new Map();
  for (const text of texts) {
    for (const match of text.matchAll(HEX)) {
      let hex = match[1].toLowerCase();
      if (hex.length === 3)
        hex = hex
          .split('')
          .map((c) => c + c)
          .join('');
      hex = `#${hex}`;
      // Near-white/near-black noise dominates template CSS; keep the accents.
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const weight = sat > 0.12 ? 3 : 1;
      counts.set(hex, (counts.get(hex) ?? 0) + weight);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([hex]) => hex);
}

function stackOf(html) {
  const head = html.slice(0, 60_000);
  const hits = [];
  if (/bootstrap(\.min)?\.css|class="[^"]*\bcontainer-fluid\b/i.test(head)) hits.push('bootstrap');
  if (/jquery(\.min)?\.js|slick|owl-carousel|magnific-popup/i.test(head)) hits.push('jquery');
  if (/tailwind/i.test(head)) hits.push('tailwind');
  if (/__NEXT_DATA__|data-reactroot|id="root"/i.test(head)) hits.push('react');
  if (/vue(\.min)?\.js|v-app/i.test(head)) hits.push('vue');
  if (!hits.length) hits.push('html5');
  return hits.slice(0, 3).join('+');
}

/**
 * Style traits come from the stylesheet, not the markup: in HTML the same words
 * appear in every bundled plugin, which made all 200 templates identical.
 */
function styleOf(html, css) {
  const tags = [];
  if (/min-height\s*:\s*(9\d|100)vh|height\s*:\s*100vh/i.test(css)) tags.push('fullbleed-hero');
  if (/carousel|slider|swiper|owl-/i.test(css)) tags.push('carousel');
  if (/video/i.test(html.slice(0, 80_000))) tags.push('video');
  if (/background(-color)?\s*:\s*#(0[0-9a-f]|1[0-9a-f]|2[0-9a-f])[0-9a-f]{4}/i.test(css)) {
    tags.push('dark');
  }
  if (/playfair|georgia|cormorant|serif/i.test(css)) tags.push('serif');
  if (/grid|masonry|isotope/i.test(css)) tags.push('grid');
  if (/box-shadow/i.test(css)) tags.push('cards');
  if (/parallax/i.test(css)) tags.push('parallax');
  if (/letter-spacing\s*:\s*(\.|0\.[2-9])/i.test(css)) tags.push('editorial');
  if (/border-radius\s*:\s*0/i.test(css)) tags.push('square');
  return [...new Set(tags)].slice(0, 6);
}

function titleOf(html, fallback) {
  const title = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html)?.[1] ?? '';
  const og =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{1,80})["']/i.exec(html)?.[1] ??
    '';
  const cleaned = (og || title)
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s*[|–—-]\s*(colorlib|template|free|html|bootstrap|responsive).*$/i, '')
    .replace(/\b(colorlib|cozastore|free html template)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 60) : fallback;
}

function slugOf(key) {
  const name = key.split('/').pop() ?? key;
  return name
    .toLowerCase()
    .replace(/-master.*$|-gh-pages.*$|-v?\d+(\.\d+)*.*$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function cleanName(key) {
  return (key.split('/').pop() ?? key)
    .replace(/[-_]?master.*$|[-_]?gh-pages.*$|[-_]?v?\d+(\.\d+)+.*$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 60);
}

/* ────────────────────────────────── build ────────────────────────────── */

const zips = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => path.join(DIR, f))
  : [];

if (!zips.length) {
  console.error(`No .zip archives found in ${DIR}. Set WEBSITE_TEMPLATES_DIR.`);
  process.exit(1);
}

const records = new Map();

for (const zip of zips) {
  const entries = listZip(zip);
  const groups = groupTemplates(entries);
  // A flat project (no per-template directory) is one template named after the zip.
  if (groups.length === 1 && groups[0][1].every((f) => !f.includes('/'))) {
    const files = entries;
    const html = bestHtml(files);
    if (!html) continue;
    groups.splice(0, 1, [path.basename(zip, '.zip'), files]);
  }

  for (const [key, files] of groups) {
    const id = slugOf(key);
    if (!id || records.has(id)) continue;
    const htmlPath = bestHtml(files);
    if (!htmlPath) continue;
    const cssPath = bestCss(files);
    const html = readEntry(zip, htmlPath, 600_000);
    const css = cssPath ? readEntry(zip, cssPath, 600_000) : '';
    if (!html) continue;

    const name = titleOf(html, cleanName(key));
    const rawTitle = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html)?.[1] ?? '';
    const category = categoryOf({ key, name, title: rawTitle });
    const palette = paletteOf(css);
    records.set(id, {
      id,
      name,
      category,
      ourType: OUR_TYPE[category] ?? 'other',
      stack: stackOf(html),
      style: styleOf(html, css),
      palette: palette.length ? palette : ['#111111', '#ffffff'],
      source: path.basename(zip, '.zip'),
    });
    process.stdout.write('.');
  }
  process.stdout.write(`\n${path.basename(zip)}: ${groups.length} templates\n`);
}

const out = [...records.values()].sort((a, b) => a.id.localeCompare(b.id));

const header = `/**
 * AUTO-GENERATED by \`scripts/build-design-catalog.mjs\` — do not edit by hand.
 *
 * ${out.length} template design records distilled from the vendored template
 * archives. Only metadata is kept: no template HTML, CSS, images or scripts are
 * copied into this repo or shown to the model. The generation model ranks these
 * records and then composes a fresh storefront from OUR section kit.
 */
export interface TemplateCatalogRecord {
  /** Stable library id used by the design document's \`source.catalogId\`. */
  id: string;
  name: string;
  /** Library category (food, fashion, admin, …), not a platform business type. */
  category: string;
  /** Closest platform business type for candidate pre-filtering. */
  ourType: string;
  /** Original stack, kept as a style signal (bootstrap, jquery, …). */
  stack: string;
  style: readonly string[];
  palette: readonly string[];
  /** Archive the record came from (provenance, never rendered). */
  source: string;
}

export const TEMPLATE_CATALOG: readonly TemplateCatalogRecord[] = `;

const body = JSON.stringify(out, null, 2)
  .replace(/\[\n\s+"([^"]*)"\n\s+\]/g, '["$1"]')
  .replace(/"([^"]+)":/g, '$1:');

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `${header}${body};\n`);
console.log(`Wrote ${out.length} records → ${path.relative(process.cwd(), OUT)}`);
