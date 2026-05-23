-- Evita re-tentar Cosmos/R2 para price_points onde a busca já falhou.
alter table public.price_points
  add column if not exists tentativa_busca_imagem boolean not null default false;

create index if not exists price_points_tentativa_busca_imagem_idx
  on public.price_points (tentativa_busca_imagem)
  where image_url is null;
