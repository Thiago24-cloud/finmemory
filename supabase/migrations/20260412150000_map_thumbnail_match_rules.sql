-- Regras editáveis no painel: palavras-chave no nome do produto → rótulo do repositório de miniaturas (map_product_image_cache).
-- Servidor usa SUPABASE_SERVICE_ROLE_KEY (ignora RLS). Sem policies = cliente anon/authenticated não lê.

create table if not exists public.map_thumbnail_match_rules (
  id uuid primary key default gen_random_uuid(),
  canonical_label text not null,
  keywords text[] not null default '{}',
  retail_context text not null default 'supermarket'
    check (retail_context in ('supermarket', 'fast_food', 'any')),
  sort_order int not null default 100,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_thumbnail_match_rules_active_sort_idx
  on public.map_thumbnail_match_rules (active, sort_order, id);

comment on table public.map_thumbnail_match_rules is
  'Painel /admin/map-thumbnail-rules: keywords → canonical_label para cache de miniaturas do mapa.';

drop trigger if exists map_thumbnail_match_rules_set_updated_at on public.map_thumbnail_match_rules;
create trigger map_thumbnail_match_rules_set_updated_at
  before update on public.map_thumbnail_match_rules
  for each row execute function public.update_updated_at_column();

alter table public.map_thumbnail_match_rules enable row level security;
