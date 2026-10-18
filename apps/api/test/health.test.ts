import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('api smoke tests', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('GET /roles returns the shared role list', async () => {
    const res = await app.request('/roles');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { roles: string[] };
    expect(body.roles).toContain('seller');
    expect(body.roles).toContain('customer');
    expect(body.roles).toContain('admin');
  });
});
