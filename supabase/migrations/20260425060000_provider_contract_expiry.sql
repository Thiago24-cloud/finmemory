-- Compatibiliza constraints com contrato unificado dos providers (expiry_date).
create or replace function public.bot_produtos_all_have_validity(p_produtos jsonb)
returns boolean
language sql
immutable
as $fn$
  select coalesce(
    bool_and(
      coalesce(
        nullif(trim(e->>'expiry_date'), ''),
        nullif(trim(e->>'valid_until'), ''),
        nullif(trim(e->>'validade'), ''),
        nullif(trim(e->>'expires_at'), '')
      ) is not null
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
