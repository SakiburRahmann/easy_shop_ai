/** Public product columns. Deliberately excludes `floor_price` (bargaining). */
export const PUBLIC_PRODUCT_FIELDS =
  'id, shop_id, category_id, name, description, price, stock, images, active, created_at, updated_at, variants(id, product_id, size, color, stock, price_override, created_at)';
