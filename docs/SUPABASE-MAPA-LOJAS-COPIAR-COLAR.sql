-- =============================================================================
-- FinMemory — Copiar e colar no Supabase (SQL Editor)
-- =============================================================================
-- Parte A: só índices → acelera o mapa; NÃO muda o que aparece hoje no mapa.
-- Parte B: modelo de INSERT — use quando quiser ADICIONAR lojas (aí sim novos pins).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PARTE A — Performance (recomendado; invisível no mapa)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_price_points_lat_lng_partial
  ON public.price_points (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promocoes_supermercados_lat_lng_active
  ON public.promocoes_supermercados (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND ativo = true;

-- ---------------------------------------------------------------------------
-- PARTE B — Quando for cadastrar MAIS supermercados (pins verdes/laranja)
-- Descomente o bloco, ajuste os valores e execute. `place_id` precisa ser ÚNICO.
-- ---------------------------------------------------------------------------
/*
INSERT INTO public.stores (
  name,
  type,
  address,
  lat,
  lng,
  radius_meters,
  place_id,
  neighborhood,
  city,
  active
)
SELECT
  'NOME EXATO DA LOJA (como no Google Maps)',
  'supermarket',
  'Endereço completo, Cidade - UF',
  -23.55000::double precision,
  -46.63000::double precision,
  100,
  'manual-' || gen_random_uuid()::text,
  'Bairro',
  'São Paulo',
  true;
*/
