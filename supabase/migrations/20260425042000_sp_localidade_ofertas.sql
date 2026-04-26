-- Segmentação regional de ofertas para SP (fila + publicação)
alter table if exists public.bot_promocoes_fila
  add column if not exists locality_scope text,
  add column if not exists locality_city text,
  add column if not exists locality_state text;

update public.bot_promocoes_fila
set locality_state = 'SP'
where locality_state is null;

alter table public.bot_promocoes_fila
  alter column locality_state set default 'SP',
  alter column locality_state set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_promocoes_fila_locality_scope_check'
  ) then
    alter table public.bot_promocoes_fila
      add constraint bot_promocoes_fila_locality_scope_check
      check (
        locality_scope is null
        or locality_scope in ('Estadual', 'Grande SP', 'Cidade')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_promocoes_fila_locality_state_sp_check'
  ) then
    alter table public.bot_promocoes_fila
      add constraint bot_promocoes_fila_locality_state_sp_check
      check (locality_state = 'SP')
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'bot_produtos_all_have_validity'
      and pg_function_is_visible(oid)
  ) then
    create function public.bot_produtos_all_have_validity(p_produtos jsonb)
    returns boolean
    language sql
    immutable
    as $fn$
      select coalesce(
        bool_and(
          coalesce(nullif(trim(e->>'valid_until'), ''), nullif(trim(e->>'validade'), ''), nullif(trim(e->>'expires_at'), '')) is not null
        ),
        false
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(p_produtos) = 'array' then p_produtos
          else '[]'::jsonb
        end
      ) as e;
    $fn$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_promocoes_fila_validity_required_check'
  ) then
    alter table public.bot_promocoes_fila
      add constraint bot_promocoes_fila_validity_required_check
      check (public.bot_produtos_all_have_validity(produtos))
      not valid;
  end if;
end $$;

create index if not exists bot_promocoes_fila_locality_scope_idx
  on public.bot_promocoes_fila (locality_scope, created_at desc);

-- Campos opcionais para consumo analítico no mapa
alter table if exists public.price_points
  add column if not exists locality_scope text,
  add column if not exists locality_city text,
  add column if not exists locality_state text,
  add column if not exists expires_at date,
  add column if not exists discount_percent numeric(6,2),
  add column if not exists unit_normalized text;

update public.price_points
set locality_state = 'SP'
where source = 'bot_fila_aprovado'
  and locality_state is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_points_sp_only_bot_fila_check'
  ) then
    alter table public.price_points
      add constraint price_points_sp_only_bot_fila_check
      check (source <> 'bot_fila_aprovado' or locality_state = 'SP')
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_points_validity_required_bot_fila_check'
  ) then
    alter table public.price_points
      add constraint price_points_validity_required_bot_fila_check
      check (source <> 'bot_fila_aprovado' or expires_at is not null)
      not valid;
  end if;
end $$;
