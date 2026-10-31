-- Bargaining verdicts accepted for a conversation. When the server's
-- check_discount accepts or counters, the agreed unit price is stored here;
-- create_order applies it for that conversation+product. The model cannot
-- invent prices: lookups are by server-set conversation id.
create table if not exists public.negotiated_prices (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, product_id)
);

alter table public.negotiated_prices enable row level security;

drop policy if exists negotiated_prices_owner on public.negotiated_prices;
create policy negotiated_prices_owner on public.negotiated_prices
  for all to authenticated
  using (
    exists (
      select 1
      from public.conversations cv
      join public.shops s on s.id = cv.shop_id
      where cv.id = negotiated_prices.conversation_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations cv
      join public.shops s on s.id = cv.shop_id
      where cv.id = negotiated_prices.conversation_id and s.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.negotiated_prices to authenticated, service_role;
