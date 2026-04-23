-- Fila de aprovação para promoções enviadas pelo bot/scraper
create table if not exists public.bot_promocoes_fila (
  id               uuid primary key default gen_random_uuid(),
  store_name       text not null,
  store_address    text,
  store_lat        double precision,
  store_lng        double precision,
  produtos         jsonb not null default '[]'::jsonb,
  origem           text not null,
  status           text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      text
);

alter table public.bot_promocoes_fila enable row level security;

-- Só service role (server-side) ou admins autenticados podem ler/escrever
create policy "admin_full_access" on public.bot_promocoes_fila
  for all
  using (
    (select count(*) from public.profiles where id = auth.uid() and is_admin = true) > 0
  )
  with check (
    (select count(*) from public.profiles where id = auth.uid() and is_admin = true) > 0
  );

-- Índice para listagem de pendentes
create index if not exists bot_promocoes_fila_status_idx on public.bot_promocoes_fila (status, created_at desc);
