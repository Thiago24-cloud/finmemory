alter table if exists public.bot_promocoes_fila
  add column if not exists artifacts jsonb not null default '{}'::jsonb;

comment on column public.bot_promocoes_fila.artifacts is
  'Metadados de evidência do encarte/origem para curadoria manual (ex.: source_page_url, flyer_asset_urls).';

