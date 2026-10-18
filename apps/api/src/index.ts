import { userRoleSchema } from '@easyshop/shared';
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.json({ service: 'easyshop-api', status: 'ok' }));

app.get('/health', (c) => c.json({ ok: true }));

app.get('/roles', (c) => c.json({ roles: userRoleSchema.options }));

export default app;

export type AppType = typeof app;
