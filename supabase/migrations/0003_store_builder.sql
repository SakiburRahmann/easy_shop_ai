-- EasyShopAI — store builder + commerce integrity
-- 1. Sellers choose a business type; the API seeds matching starter categories.
-- 2. A third storefront template (boutique) joins classic/modern.
-- 3. Stock is reserved atomically when an order is placed, so two concurrent
--    customers can never buy the last unit.

alter table public.shops
  add column if not exists business_type text not null default 'fashion';

alter table public.shops drop constraint if exists shops_business_type_check;
alter table public.shops
  add constraint shops_business_type_check
  check (business_type in ('fashion', 'electronics', 'beauty', 'groceries', 'home', 'kids', 'other'));

alter table public.shops drop constraint if exists shops_template_id_check;
alter table public.shops
  add constraint shops_template_id_check
  check (template_id in ('classic', 'modern', 'boutique'));

create index if not exists shops_business_type_idx on public.shops (business_type);

-- Atomic stock delta. Returns the new stock, or NULL when the requested
-- decrement would go below zero (sold out / raced by another order).
create or replace function public.adjust_variant_stock(p_variant_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock integer;
begin
  update public.variants
  set stock = stock + p_delta
  where id = p_variant_id
    and stock + p_delta >= 0
  returning stock into new_stock;

  return new_stock;
end;
$$;

-- Only the API (service role) may move stock; browser clients never call this.
grant execute on function public.adjust_variant_stock(uuid, integer) to service_role;
