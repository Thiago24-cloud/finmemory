-- GRANTs para leitura direta (anon/authenticated) + coords na RPC do feed parceiros.

GRANT SELECT ON public.produtos_loja TO anon, authenticated;
GRANT SELECT ON public.usuarios_loja TO authenticated;

-- Postgres não permite mudar RETURNS TABLE com CREATE OR REPLACE — recriar a função.
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
  'Ofertas ativas (produtos_loja) no raio (km), com coords da loja para pins no mapa.';

REVOKE ALL ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision)
  TO anon, authenticated, service_role;
