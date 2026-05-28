-- Campo para URL de imagem padronizada (fundo branco/object-contain) usada nos cards.
alter table if exists public.produtos_loja
  add column if not exists image_optimized_url text;

comment on column public.produtos_loja.image_optimized_url is
  'URL da imagem otimizada/padronizada para exibição premium no ProductCard.';
