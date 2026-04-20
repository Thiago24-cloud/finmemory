-- URL opcional por regra: keyword match → imagem direta (prioridade sobre cache e APIs).

alter table public.map_thumbnail_match_rules
  add column if not exists image_url text;

comment on column public.map_thumbnail_match_rules.image_url is
  'HTTPS opcional; quando preenchido, o mapa usa esta imagem antes do repositório map_product_image_cache e antes de OFF/CSE.';
