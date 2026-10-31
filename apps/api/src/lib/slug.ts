/**
 * Slug generation for shop URLs. Pure functions — unit tested.
 */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-[^a-z0-9]*$/, '');
  return slug.length >= 3 && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) ? slug : '';
}

export function slugVariants(base: string): string[] {
  const out = [base];
  for (let i = 2; i <= 50; i++) out.push(`${base}-${i}`);
  return out;
}
