-- Security Advisor (Supabase): corrige alertas em public.lojas e public.spatial_ref_sys.
-- Não altera comportamento do mapa FinMemory (app usa public.stores via API service role).

-- ---------------------------------------------------------------------------
-- 1) View public.lojas — security_invoker (respeita permissões/RLS do caller em stores)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.lojas;

CREATE VIEW public.lojas
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.name AS nome_comercial,
  s.cnpj,
  s.address AS endereco,
  s.lat::numeric AS latitude,
  s.lng::numeric AS longitude,
  s.tempo_preparo_medio,
  COALESCE(s.active, true) AS status_ativa,
  s.created_at
FROM public.stores s;

COMMENT ON VIEW public.lojas IS
  'Tenants FinMemory Parceiros (espelho de public.stores). security_invoker=true para o Security Advisor.';

-- O app não consulta esta view no cliente; evita SELECT direto via PostgREST.
REVOKE ALL ON TABLE public.lojas FROM PUBLIC;
REVOKE ALL ON TABLE public.lojas FROM anon;
REVOKE ALL ON TABLE public.lojas FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2) PostGIS spatial_ref_sys — catálogo de sistema; RLS fechado para anon/authenticated
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RAISE NOTICE 'spatial_ref_sys ausente (PostGIS não instalado); ignorado.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_deny_anon ON public.spatial_ref_sys';
  EXECUTE $pol$
    CREATE POLICY spatial_ref_sys_deny_anon ON public.spatial_ref_sys
      FOR ALL TO anon
      USING (false)
      WITH CHECK (false)
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_deny_authenticated ON public.spatial_ref_sys';
  EXECUTE $pol$
    CREATE POLICY spatial_ref_sys_deny_authenticated ON public.spatial_ref_sys
      FOR ALL TO authenticated
      USING (false)
      WITH CHECK (false)
  $pol$;
END $$;
