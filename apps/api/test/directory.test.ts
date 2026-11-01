import { describe, expect, it } from 'vitest';
import { sanitizePostgrestIlike, toDirectoryItems } from '../src/lib/directory';

const shop = {
  id: 'c16113bf-7fcf-420a-9461-0f0fbed02460',
  name: 'Rahman Fashion',
  slug: 'rahman-fashion',
  description: 'Sarees and panjabis',
  template_id: 'classic',
  theme: { primaryColor: '#0EA5E9' },
  contact: { phone: '+8801700000000' },
};

describe('sanitizePostgrestIlike', () => {
  it('strips PostgREST or= syntax characters', () => {
    expect(sanitizePostgrestIlike(`abc,(def),"ghi"`)).toBe('abc def ghi');
  });
  it('keeps plain text intact', () => {
    expect(sanitizePostgrestIlike('saree')).toBe('saree');
  });
  it('trims whitespace', () => {
    expect(sanitizePostgrestIlike('  sari  ')).toBe('sari');
  });
});

describe('toDirectoryItems', () => {
  it('counts active products per shop and caps collage images at 4', () => {
    const productRows = [1, 2, 3, 4, 5].map((i) => ({
      shop_id: shop.id,
      images: [`https://img.example/${i}.jpg`],
    }));
    const [item] = toDirectoryItems([shop], productRows);
    expect(item?.productCount).toBe(5);
    expect(item?.topImages).toHaveLength(4); // capped, not 5
  });

  it('separates shops and skips rows with no matching products', () => {
    const other = { ...shop, id: '10e8cee7-0000-4000-8000-000000000001', slug: 'other' };
    const productRows = [
      { shop_id: shop.id, images: ['https://a.example/1.jpg'] },
      { shop_id: other.id, images: [] },
      { shop_id: other.id, images: ['https://a.example/2.jpg'] },
    ];
    const [first, second] = toDirectoryItems([shop, other], productRows);
    expect(first?.productCount).toBe(1);
    expect(second?.productCount).toBe(2);
    expect(second?.topImages).toEqual(['https://a.example/2.jpg']);
  });

  it('drops invalid shape rows instead of throwing', () => {
    const bad = { ...shop, slug: 'Bad Slug With Spaces' };
    expect(toDirectoryItems([bad], [])).toHaveLength(0);
  });

  it('normalizes unknown template ids to classic', () => {
    const [item] = toDirectoryItems([{ ...shop, template_id: 'secret-v2' }], []);
    expect(item?.templateId).toBe('classic');
  });

  it('never includes owner or pricing secrets', () => {
    const [item] = toDirectoryItems(
      [{ ...shop, owner_id: 'xyz' }],
      [{ shop_id: shop.id, images: ['https://a.example/1.jpg'] }],
    );
    expect(Object.keys(item ?? {}).sort()).toEqual(
      [
        'businessType',
        'contact',
        'description',
        'id',
        'name',
        'productCount',
        'slug',
        'templateId',
        'theme',
        'topImages',
      ].sort(),
    );
  });
});
