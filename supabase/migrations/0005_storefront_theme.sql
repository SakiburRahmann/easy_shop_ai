-- EasyShopAI — applied storefront themes
--
-- A shop can now carry ONE applied theme document: composition, palette,
-- typography and short copy, chosen by the SELLER from the theme library. This
-- is the Shopify/Odoo model — presets plus settings, no generated code.
--
-- Nullable on purpose: shops created before this migration (and shops whose
-- seller has not picked a theme yet) keep rendering from `template_id` +
-- `theme`. Reads are validated with `storefrontThemeSchema`, so a malformed row
-- degrades to the house preset instead of breaking the storefront.

alter table public.shops
  add column if not exists storefront jsonb;

comment on column public.shops.storefront is
  'Applied theme preset + shop copy (StorefrontTheme in packages/shared). Null = render the template_id house preset.';
