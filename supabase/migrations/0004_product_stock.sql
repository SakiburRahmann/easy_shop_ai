-- EasyShopAI — product-level stock
--
-- Variant products track inventory per variant; products sold without variants
-- need their own counter. Before this migration a variantless product could be
-- ordered forever (the checkout only checked variant stock), while the seller
-- dashboard displayed "stock 0". This closes that integrity gap.

alter table public.products
  add column if not exists stock integer not null default 0;

alter table public.products drop constraint if exists products_stock_check;
alter table public.products
  add constraint products_stock_check check (stock >= 0);

-- Give existing variantless products a sensible starting inventory so live
-- shops do not become silently sold out after the migration.
update public.products p
set stock = 10
where p.stock = 0
  and p.active = true
  and not exists (select 1 from public.variants v where v.product_id = p.id);

-- Atomic product-stock delta. Returns the new stock, or NULL when the
-- requested decrement would go below zero (sold out / raced by an order).
create or replace function public.adjust_product_stock(p_product_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock integer;
begin
  update public.products
  set stock = stock + p_delta
  where id = p_product_id
    and stock + p_delta >= 0
  returning stock into new_stock;

  return new_stock;
end;
$$;

-- Only the API (service role) may move stock; browser clients never call this.
grant execute on function public.adjust_product_stock(uuid, integer) to service_role;
