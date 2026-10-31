/**
 * Apply SQL migrations from supabase/migrations to the Supabase database.
 *
 * Reads credentials from the repo-root .env.local (never from code).
 * Prefers the session pooler (works over IPv4) and falls back to the
 * direct connection. Usage:
 *
 *   pnpm --filter @easyshop/api db:apply
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');

/** Minimal .env parser for our flat KEY=value files. */
function readEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["'](.*)["']$/, '$1');
    if (!(key in out)) out[key] = value;
  }
  return out;
}

const envFile = join(repoRoot, '.env.local');
const env = { ...process.env, ...readEnvFile(envFile) };

/** Build a pg config from a postgres:// URL, decoding the percent-encoded password. */
function parseUrl(raw) {
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

const candidates = [];
if (env.SUPABASE_SESSION_POOLER_URL)
  candidates.push(['session pooler', parseUrl(env.SUPABASE_SESSION_POOLER_URL)]);
if (env.DATABASE_URL) candidates.push(['direct connection', parseUrl(env.DATABASE_URL)]);

if (candidates.length === 0) {
  console.error(
    'No database URL found in .env.local (need SUPABASE_SESSION_POOLER_URL or DATABASE_URL)',
  );
  process.exit(1);
}

const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
if (migrations.length === 0) {
  console.error(`No .sql files found in ${migrationsDir}`);
  process.exit(1);
}

let client = null;
let connectedVia = null;
for (const [label, config] of candidates) {
  try {
    client = new pg.Client(config);
    await client.connect();
    connectedVia = label;
    break;
  } catch (error) {
    console.error(`- ${label} failed: ${error.message}`);
    client = null;
  }
}
if (!client) {
  console.error('Could not connect with any database URL.');
  process.exit(1);
}

console.log(`Connected via ${connectedVia}.`);

await client.query(
  'create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())',
);

const { rows } = await client.query('select name from public.schema_migrations');
const applied = new Set(rows.map((r) => r.name));

for (const file of migrations) {
  if (applied.has(file)) {
    console.log(`= ${file} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into public.schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log(`+ ${file} applied`);
  } catch (error) {
    await client.query('rollback');
    console.error(`x ${file} failed:`);
    console.error(error.message);
    process.exit(1);
  }
}

await client.end();
console.log('Done.');
