-- Expansão logística SP: cidade/DDD/região + oferta estadual + retenção automática.

alter table if exists public.bot_promocoes_fila
  add column if not exists locality_region text,
  add column if not exists ddd_code text,
  add column if not exists is_statewide boolean not null default false;

alter table if exists public.price_points
  add column if not exists locality_region text,
  add column if not exists ddd_code text,
  add column if not exists is_statewide boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bot_promocoes_fila_is_statewide_consistency_check'
  ) then
    alter table public.bot_promocoes_fila
      add constraint bot_promocoes_fila_is_statewide_consistency_check
      check (not is_statewide or (locality_scope = 'Estadual' and locality_city is null))
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'price_points_is_statewide_consistency_check'
  ) then
    alter table public.price_points
      add constraint price_points_is_statewide_consistency_check
      check (not is_statewide or (locality_scope = 'Estadual' and locality_city is null))
      not valid;
  end if;
end $$;

create index if not exists bot_promocoes_fila_locality_state_city_idx
  on public.bot_promocoes_fila (locality_state, locality_city, created_at desc);

create index if not exists price_points_locality_state_city_idx
  on public.price_points (locality_state, locality_city, created_at desc);

-- Cleanup automática: remove promoções bot expiradas há mais de 24h.
create or replace function public.cleanup_expired_sp_promos()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.price_points
  where source = 'bot_fila_aprovado'
    and expires_at is not null
    and expires_at < (now() - interval '24 hours')::date;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Tenta habilitar/sincronizar cron sem quebrar migração caso extensão não esteja disponível.
do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception when others then
    -- Sem extensão, apenas segue: função permanece disponível para execução manual.
    null;
  end;

  if to_regnamespace('cron') is not null then
    if not exists (
      select 1 from cron.job where jobname = 'cleanup_expired_sp_promos_hourly'
    ) then
      perform cron.schedule(
        'cleanup_expired_sp_promos_hourly',
        '17 * * * *',
        'select public.cleanup_expired_sp_promos();'
      );
    end if;
  end if;
end $$;
