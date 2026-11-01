/**
 * Pure catalog search used by the AI `search_products` tool.
 *
 * The model can phrase a query in Bangla, Banglish or English, and products
 * may store either script. Matching therefore normalizes colors/garment words
 * to canonical English tokens, then applies EVERY requested filter — color,
 * size, category and price. Regression note: price used to be skipped when a
 * color or size was supplied, so "red tee under ৳1000" ignored the budget.
 */

export interface ProductSearchRow extends Record<string, unknown> {
  variants?: unknown[];
}

/** Banglish/Bangla → English keyword synonyms for search matching. */
export const SYNONYMS: Record<string, string> = {
  lal: 'red',
  red: 'red',
  kalo: 'black',
  kala: 'black',
  black: 'black',
  sadha: 'white',
  safa: 'white',
  white: 'white',
  neel: 'blue',
  blue: 'blue',
  sobuj: 'green',
  green: 'green',
  holud: 'yellow',
  yellow: 'yellow',
  gulabi: 'pink',
  pink: 'pink',
  sab: 'teal',
  teal: 'teal',
  tshirt: 't-shirt',
  't-shirt': 't-shirt',
  shirt: 'shirt',
  tee: 't-shirt',
  sharee: 'saree',
  saree: 'saree',
  shari: 'saree',
  panjabi: 'panjabi',
  punjabi: 'panjabi',
  kids: 'kids',
  denim: 'denim',
};

/** Bangla (script) words the model may pass as args — mapped to English. */
export const BANGLA_KEYWORDS: Record<string, string> = {
  লাল: 'red',
  কালো: 'black',
  কালা: 'black',
  সাদা: 'white',
  নীল: 'blue',
  নেভি: 'navy',
  সবুজ: 'green',
  হলুদ: 'yellow',
  গোলাপি: 'pink',
  ছাই: 'grey',
  ধূসর: 'grey',
  গ্রে: 'grey',
  শাড়ি: 'saree',
  টিশার্ট: 't-shirt',
  পাঞ্জাবি: 'panjabi',
};

/** Translates a free-form color/type phrase (any language) to canonical EN. */
export function canonicalPhrase(s: string): string {
  const norm = s.toLowerCase();
  const words = norm.split(/[^a-z0-9\u0980-\u09ff]+/).filter(Boolean);
  const mapped = words.map(
    (w) => SYNONYMS[w.replace(/-/g, '')] ?? SYNONYMS[w] ?? BANGLA_KEYWORDS[w] ?? w,
  );
  return mapped.join(' ').trim();
}

const STOPWORDS = new Set([
  'yes',
  'no',
  'ok',
  'okay',
  'please',
  'confirm',
  'confirmed',
  'order',
  'kore',
  'din',
  'dorkar',
  'lagbe',
  'chai',
  'nibo',
  'nite',
  'ekta',
  'one',
  'two',
  '1pc',
  'pcs',
  'piece',
  'pc',
  'pieces',
  'size',
  'the',
  'and',
  'for',
  'want',
  'need',
  'buy',
  'hobe',
  'ache',
  'kori',
  'korte',
  'ami',
  'price',
  'dam',
  'taka',
  'takar',
  'moddhe',
  'under',
  'below',
  'less',
  'within',
  'budget',
  'cheap',
  'er',
  'nam',
  'address',
]);

/** Splits free text into meaningful, synonym-normalized tokens. */
export function textTokens(q: string | undefined): string[] {
  if (!q) return [];
  const raw = q
    .toLowerCase()
    .split(/[^a-z0-9\u0980-\u09ff-]+/)
    .filter(Boolean);
  const tokens: string[] = [];
  for (const t of raw) {
    if (t.length < 3 || STOPWORDS.has(t) || /^\d+$/.test(t)) continue;
    const normalized = SYNONYMS[t.replace(/-/g, '')] ?? SYNONYMS[t] ?? t.replace(/-/g, '');
    tokens.push(normalized);
    const synonym = SYNONYMS[t.replace(/-/g, '')];
    if (synonym && synonym !== normalized) tokens.push(synonym);
  }
  return [...new Set(tokens)];
}

/** Strips PostgREST/filter punctuation from a model-supplied query. */
export function cleanQuery(q: unknown): string | undefined {
  if (typeof q !== 'string') return undefined;
  const cleaned = q
    .replace(/[%_,()]/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || undefined;
}

function variantsOf(row: ProductSearchRow): Record<string, unknown>[] {
  return Array.isArray(row.variants)
    ? row.variants.map((v) =>
        v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {},
      )
    : [];
}

function numberValue(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function haystackOf(row: ProductSearchRow): string {
  return `${String(row.name ?? '')} ${String(row.description ?? '')}`.toLowerCase();
}

export interface ProductSearchFilters {
  /** Normalized words from the free-text query. */
  tokens: string[];
  /** Resolved category ids for the shop, or null when no category hint. */
  categoryIds: string[] | null;
  /** Requested color, canonicalized. */
  color: string;
  /** Requested size, lowercased. */
  size: string;
  maxPrice?: number;
}

export interface ProductSearchResult {
  matched: ProductSearchRow[];
  note: string;
}

function matchesAttributes(row: ProductSearchRow, filters: ProductSearchFilters): boolean {
  const { categoryIds, color, size, maxPrice } = filters;

  if (categoryIds && !categoryIds.includes(String(row.category_id ?? ''))) return false;

  const variants = variantsOf(row);
  const haystack = haystackOf(row);

  if (color) {
    const variantColor = variants.some((v) => {
      const value = canonicalPhrase(String(v.color ?? ''));
      return value.includes(color) || color.includes(value);
    });
    if (!variantColor && !haystack.includes(color)) return false;
  }

  if (size) {
    const variantSize = variants.some(
      (v) =>
        String(v.size ?? '')
          .toLowerCase()
          .trim() === size,
    );
    // Fall back to a whole word in the product text — never a substring, so
    // size "M" does not match the word "premium".
    const textSize = haystack
      .split(/[^a-z0-9-]+/)
      .filter(Boolean)
      .some((word) => word === size);
    if (!variantSize && !textSize) return false;
  }

  if (maxPrice != null) {
    const overrides = variants.map((v) => numberValue(v.price_override)).filter((n) => n > 0);
    const minPrice = Math.min(
      numberValue(row.price),
      ...(overrides.length ? overrides : [Infinity]),
    );
    if (minPrice > maxPrice) return false;
  }

  return true;
}

/**
 * Applies every filter, then falls back gracefully:
 * attributes first, then name/description text, then the newest products when
 * the model gave no filters at all. The model always sees real rows or an
 * explicit empty result.
 */
export function filterProductRows(
  rows: ProductSearchRow[],
  filters: ProductSearchFilters,
): ProductSearchResult {
  const hasFilters =
    filters.tokens.length > 0 ||
    Boolean(filters.color) ||
    Boolean(filters.size) ||
    filters.maxPrice != null ||
    Boolean(filters.categoryIds);
  if (!hasFilters) {
    return {
      matched: rows.slice(0, 6),
      note: 'No search filters provided; showing the newest products.',
    };
  }

  const textMatch = (row: ProductSearchRow): boolean => {
    const haystack = haystackOf(row);
    return filters.tokens.some((t) => haystack.includes(t));
  };

  const attrMatches = rows.filter((row) => matchesAttributes(row, filters));
  let matched: ProductSearchRow[] = [];
  let note = '';

  if (attrMatches.length) {
    if (filters.tokens.length) {
      const textMatches = attrMatches.filter(textMatch);
      matched = textMatches.length ? textMatches : attrMatches;
      if (!textMatches.length) {
        note =
          'Products matched by color/size/price but not by name keyword — verify they still fit the request.';
      }
    } else {
      matched = attrMatches;
    }
  } else if (filters.tokens.length) {
    matched = rows.filter(textMatch);
    if (matched.length) {
      note =
        'No exact color/size match for the request; these match the item by name — check the per-variant stock and colors above before answering.';
    }
  }

  return { matched: matched.slice(0, 6), note };
}
