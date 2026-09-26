-- Alertas de queda de preço por insumo (Parceiros).
alter table if exists public.insumos_loja
  add column if not exists alerta_preco boolean not null default false;

create index if not exists insumos_loja_alerta_preco_idx
  on public.insumos_loja (loja_id)
  where alerta_preco = true;
