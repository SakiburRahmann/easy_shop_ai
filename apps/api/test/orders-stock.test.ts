import { describe, expect, it } from 'vitest';
import type { Db } from '../src/lib/db';
import { restoreStockForOrder } from '../src/lib/orders';

const orderId = '10e8cee7-0000-4000-8000-000000000010';
const productId = '10e8cee7-0000-4000-8000-000000000011';

describe('restoreStockForOrder', () => {
  it('restocks a product sold without variants', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const db = {
      from(table: string) {
        if (table === 'order_items') {
          return {
            select: (columns: string) => {
              expect(columns).toContain('product_id');
              return {
                eq: async () => ({
                  data: [{ product_id: productId, variant_id: null, qty: 2 }],
                  error: null,
                }),
              };
            },
          };
        }
        if (table === 'variants') {
          return {
            select: () => ({
              in: async () => ({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`Unexpected table in test: ${table}`);
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: 5, error: null };
      },
    } as unknown as Db;

    await restoreStockForOrder(db, orderId);

    expect(calls).toEqual([
      {
        name: 'adjust_product_stock',
        args: { p_product_id: productId, p_delta: 2 },
      },
    ]);
  });
});
