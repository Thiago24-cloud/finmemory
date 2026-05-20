-- Ajustes RLS/performance em produtos_loja (após 20260519120000).
-- 1) Ofertas públicas: TO public (anon + authenticated)
-- 2) get_meu_loja_id() + políticas de escrita sem subquery por linha
-- 3) Índice gist em stores (se ainda não existir)
-- 4) produtos_oferta_proximos com SECURITY DEFINER

CREATE EXTENSION IF NOT EXISTS postgis;

DO $idx$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_stores_point_geog
    ON public.stores
    USING gist ((st_setsrid(st_makepoint(lng, lat), 4326)::geography))
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND COALESCE(active, true) = true;
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'idx_stores_point_geog: ative postgis e volte a correr esta migração.';
  WHEN OTHERS THEN
    RAISE NOTICE 'idx_stores_point_geog: %', SQLERRM;
END
$idx$;

CREATE OR REPLACE FUNCTION public.get_meu_loja_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ul.loja_id
  FROM public.usuarios_loja ul
  WHERE ul.id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_meu_loja_id IS
  'loja_id do usuário autenticado (tenant). Usado nas políticas RLS de produtos_loja.';

REVOKE ALL ON FUNCTION public.get_meu_loja_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_loja_id() TO authenticated;

DROP FUNCTION IF EXISTS public.produtos_oferta_proximos(double precision, double precision, double precision);

CREATE FUNCTION public.produtos_oferta_proximos(
  p_lat double precision,
  p_lng double precision,
  p_raio_km double precision DEFAULT 3
)
RETURNS TABLE (
  produto_id uuid,
  loja_id uuid,
  nome_comercial text,
  nome_produto text,
  preco_oferta numeric,
  url_imagem text,
  distancia_km double precision,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS produto_id,
    p.loja_id,
    s.name AS nome_comercial,
    p.nome AS nome_produto,
    p.preco_oferta,
    p.url_imagem,
    (
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography
      ) / 1000.0
    )::double precision AS distancia_km,
    s.lat::double precision AS latitude,
    s.lng::double precision AS longitude
  FROM public.produtos_loja p
  INNER JOIN public.stores s ON s.id = p.loja_id
  WHERE COALESCE(s.active, true) = true
    AND p.em_oferta = true
    AND p.status_disponivel = true
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      GREATEST(p_raio_km, 0.1) * 1000.0
    )
  ORDER BY distancia_km ASC, p.created_at DESC;
$$;

COMMENT ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision) IS
  'Ofertas ativas (produtos_loja) de lojas num raio (km). Bypass RLS via SECURITY DEFINER; filtros no WHERE.';

REVOKE ALL ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS produtos_loja_select_tenant ON public.produtos_loja;
CREATE POLICY produtos_loja_select_tenant ON public.produtos_loja
  FOR SELECT TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS produtos_loja_insert_tenant ON public.produtos_loja;
CREATE POLICY produtos_loja_insert_tenant ON public.produtos_loja
  FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS produtos_loja_update_tenant ON public.produtos_loja;
CREATE POLICY produtos_loja_update_tenant ON public.produtos_loja
  FOR UPDATE TO authenticated
  USING (loja_id = public.get_meu_loja_id())
  WITH CHECK (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS produtos_loja_delete_tenant ON public.produtos_loja;
CREATE POLICY produtos_loja_delete_tenant ON public.produtos_loja
  FOR DELETE TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS produtos_loja_select_ofertas_publicas ON public.produtos_loja;
CREATE POLICY produtos_loja_select_ofertas_publicas ON public.produtos_loja
  FOR SELECT TO public
  USING (em_oferta = true AND status_disponivel = true);

GRANT SELECT ON public.produtos_loja TO anon, authenticated;
GRANT SELECT ON public.usuarios_loja TO authenticated;
