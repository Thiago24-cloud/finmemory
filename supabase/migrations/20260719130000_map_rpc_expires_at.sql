-- Expõe validade da promo na RPC da lista (filtros do mapa Parceiros).
-- DROP necessário: muda o RETURNS TABLE (colunas novas).

DROP FUNCTION IF EXISTS public.buscar_lojas_por_produtos_lista(text[]);

CREATE FUNCTION public.buscar_lojas_por_produtos_lista(produtos text[])
RETURNS TABLE (
  lugar_id text,
  nome_loja text,
  lat double precision,
  lng double precision,
  produto_nome text,
  preco numeric,
  origem text,
  expires_at date,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  normal_cutoff timestamptz := now() - interval '24 hours';
  promo_cutoff  timestamptz := now() - interval '168 hours';
BEGIN
  IF produtos IS NULL OR coalesce(cardinality(produtos), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ('pp:' || pp.id::text)::text AS lugar_id,
    pp.store_name::text AS nome_loja,
    pp.lat::double precision,
    pp.lng::double precision,
    pp.product_name::text AS produto_nome,
    pp.price::numeric AS preco,
    'price_point'::text AS origem,
    pp.expires_at::date AS expires_at,
    pp.created_at::timestamptz AS created_at
  FROM public.price_points pp
  WHERE pp.lat IS NOT NULL
    AND pp.lng IS NOT NULL
    AND pp.product_name NOT ILIKE '%[sim-cesta]%'
    AND (
      pp.source IS NULL
      OR pp.source IN (
        'bot_fila_aprovado',
        'admin_manual',
        'scraper_dia',
        'scraper_atacadao',
        'scraper_sonda',
        'scraper_assai',
        'community_manual'
      )
    )
    AND (pp.expires_at IS NULL OR pp.expires_at >= CURRENT_DATE)
    AND (
      (pp.category ILIKE '%promo%' AND pp.created_at >= promo_cutoff)
      OR (
        (pp.category IS NULL OR pp.category NOT ILIKE '%promo%')
        AND pp.created_at >= normal_cutoff
      )
    )
    AND EXISTS (
      SELECT 1
      FROM unnest(produtos) AS list_item
      WHERE length(trim(list_item)) >= 2
        AND (
          similarity(lower(pp.product_name), lower(trim(list_item))) > 0.35
          OR lower(pp.product_name) LIKE '%' || lower(trim(list_item)) || '%'
        )
    );

  RETURN QUERY
  SELECT
    ('promo:' || ps.id::text)::text AS lugar_id,
    ps.supermercado::text AS nome_loja,
    ps.lat::double precision,
    ps.lng::double precision,
    ps.nome_produto::text AS produto_nome,
    ps.preco::numeric AS preco,
    'promo_agent'::text AS origem,
    coalesce(ps.validade, (ps.expira_em AT TIME ZONE 'UTC')::date) AS expires_at,
    coalesce(ps.created_at, ps.atualizado_em, now())::timestamptz AS created_at
  FROM public.promocoes_supermercados ps
  WHERE ps.ativo = true
    AND ps.expira_em > now()
    AND ps.lat IS NOT NULL
    AND ps.lng IS NOT NULL
    AND ps.nome_produto NOT ILIKE '%[sim-cesta]%'
    AND EXISTS (
      SELECT 1
      FROM unnest(produtos) AS list_item
      WHERE length(trim(list_item)) >= 2
        AND (
          similarity(lower(ps.nome_produto), lower(trim(list_item))) > 0.35
          OR lower(ps.nome_produto) LIKE '%' || lower(trim(list_item)) || '%'
        )
    );
END;
$$;

COMMENT ON FUNCTION public.buscar_lojas_por_produtos_lista(text[]) IS
  'Lista ofertas do mapa por produtos; inclui expires_at/created_at; exclui [sim-cesta].';

GRANT EXECUTE ON FUNCTION public.buscar_lojas_por_produtos_lista(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.buscar_lojas_por_produtos_lista(text[]) TO authenticated;
