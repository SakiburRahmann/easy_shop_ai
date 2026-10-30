-- EasyShopAI — initial schema
-- Multi-tenant: every business table carries shop_id; queries are shop-scoped
-- server-side (API runs with the service key), RLS below is defense-in-depth.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'seller' check (role in ('seller', 'customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  description text check (description is null or char_length(description) <= 1000),
  logo_url text,
  template_id text not null default 'classic' check (template_id in ('classic', 'modern')),
  theme jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  delivery_rules jsonb not null default '{"zones": []}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  price numeric(12, 2) not null check (price >= 0),
  floor_price numeric(12, 2) not null default 0 check (floor_price >= 0 and floor_price <= price),
  images text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  price_override numeric(12, 2) check (price_override is null or price_override >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  customer_phone text not null check (customer_phone ~ '^[0-9+\-\s()]+$'),
  customer_address text not null check (char_length(customer_address) between 5 and 300),
  note text check (note is null or char_length(note) <= 500),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  source text not null default 'storefront' check (source in ('ai', 'storefront')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  variant_id uuid references public.variants (id),
  qty integer not null check (qty >= 1),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

create table if not exists public.ai_settings (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  tone text not null default 'friendly' check (tone in ('friendly', 'formal', 'playful')),
  languages text[] not null default '{bn, en}',
  max_discount_pct integer not null default 10 check (max_discount_pct between 0 and 90),
  extra_instructions text check (extra_instructions is null or char_length(extra_instructions) <= 2000),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  status text not null default 'active' check (status in ('active', 'needs_owner', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('customer', 'assistant', 'system', 'owner')),
  content text not null check (char_length(content) between 1 and 8000),
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes ---
create index if not exists products_shop_idx on public.products (shop_id, active);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists variants_product_idx on public.variants (product_id);
create index if not exists categories_shop_idx on public.categories (shop_id);
create index if not exists orders_shop_created_idx on public.orders (shop_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists conversations_shop_idx on public.conversations (shop_id, status, last_message_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ------------------------------------------------------------- triggers ----
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shops_updated_at on public.shops;
create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
drop trigger if exists ai_settings_updated_at on public.ai_settings;
create trigger ai_settings_updated_at before update on public.ai_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RLS ---
-- Enabled everywhere; only `authenticated` (the seller, if they ever use the
-- Supabase client directly) may touch their own rows. Anonymous has no direct
-- table access — all public reads go through the API. The API itself uses the
-- service key and enforces tenancy in application code.

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.ai_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.device_tokens enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists shops_owner on public.shops;
create policy shops_owner on public.shops
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists shop_children_owner on public.categories;
create policy shop_children_owner on public.categories
  for all to authenticated
  using (exists (select 1 from public.shops s where s.id = categories.shop_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.shops s where s.id = categories.shop_id and s.owner_id = auth.uid())
  );

drop policy if exists products_owner on public.products;
create policy products_owner on public.products
  for all to authenticated
  using (exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid())
  );

drop policy if exists variants_owner on public.variants;
create policy variants_owner on public.variants
  for all to authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = variants.product_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = variants.product_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists orders_owner on public.orders;
create policy orders_owner on public.orders
  for all to authenticated
  using (exists (select 1 from public.shops s where s.id = orders.shop_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.shops s where s.id = orders.shop_id and s.owner_id = auth.uid())
  );

drop policy if exists order_items_owner on public.order_items;
create policy order_items_owner on public.order_items
  for all to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.shops s on s.id = o.shop_id
      where o.id = order_items.order_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.orders o
      join public.shops s on s.id = o.shop_id
      where o.id = order_items.order_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists ai_settings_owner on public.ai_settings;
create policy ai_settings_owner on public.ai_settings
  for all to authenticated
  using (exists (select 1 from public.shops s where s.id = ai_settings.shop_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.shops s where s.id = ai_settings.shop_id and s.owner_id = auth.uid())
  );

drop policy if exists conversations_owner on public.conversations;
create policy conversations_owner on public.conversations
  for all to authenticated
  using (exists (select 1 from public.shops s where s.id = conversations.shop_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.shops s where s.id = conversations.shop_id and s.owner_id = auth.uid())
  );

drop policy if exists messages_owner on public.messages;
create policy messages_owner on public.messages
  for all to authenticated
  using (
    exists (
      select 1
      from public.conversations cv
      join public.shops s on s.id = cv.shop_id
      where cv.id = messages.conversation_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations cv
      join public.shops s on s.id = cv.shop_id
      where cv.id = messages.conversation_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists device_tokens_self on public.device_tokens;
create policy device_tokens_self on public.device_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- grants ---
grant select, insert, update, delete on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --------------------------------------------------------- storage bucket --
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
