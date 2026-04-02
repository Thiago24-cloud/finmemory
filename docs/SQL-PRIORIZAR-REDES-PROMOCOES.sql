-- =============================================================================
-- FinMemory — Priorizar redes para divulgar promoções no mapa
-- Copiar e colar no Supabase → SQL Editor (somente leitura / análise)
-- =============================================================================
-- Objetivo: ver quantas lojas cadastradas você tem por rede e onde ainda falta
-- dado em promocoes_supermercados / price_points (promo).
-- Ajuste filtros de cidade se quiser focar (ex.: Grande SP).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Volume de lojas por “rede” (heurística pelo nome — alinhe nomes ao agente)
--    Referência de aliases: finmemory-agent/agent.js → CHAIN_STORE_ALIASES
-- ---------------------------------------------------------------------------
WITH classified AS (
  SELECT
    id,
    name,
    city,
    neighborhood,
    lat,
    lng,
    CASE
      WHEN name ILIKE '%carrefour%' OR name ILIKE '%atacadão%' OR name ILIKE '%atacadao%' THEN 'carrefour_atacadao'
      WHEN name ILIKE '%assai%' OR name ILIKE '%assaí%' THEN 'assai'
      WHEN name ILIKE '%pão de açúcar%' OR name ILIKE '%pao de acucar%' OR name ILIKE '%minuto pao%' THEN 'paodeacucar'
      WHEN name ILIKE '%dia %' OR name ILIKE 'dia %' OR name ILIKE '% dia' OR name ILIKE '% dia %'
           OR name ILIKE '%supermercado dia%' OR name ILIKE '% mercado dia%' THEN 'dia'
      WHEN name ILIKE '%hirota%' THEN 'hirota'
      WHEN name ILIKE '%lopes%' THEN 'lopes'
      WHEN name ILIKE '%são jorge%' OR name ILIKE '%sao jorge%' OR name ILIKE '%sacolão%' OR name ILIKE '%sacolao%' THEN 'saojorge'
      WHEN name ILIKE '%mambo%' THEN 'mambo'
      WHEN name ILIKE '%agape%' OR name ILIKE '%ágape%' THEN 'agape'
      WHEN name ILIKE '%armazém do campo%' OR name ILIKE '%armazem do campo%' THEN 'armazemdocampo'
      ELSE 'outros'
    END AS rede_heuristica
  FROM public.stores
  WHERE COALESCE(active, true) = true
)
SELECT
  rede_heuristica,
  COUNT(*) AS lojas
FROM classified
GROUP BY 1
ORDER BY lojas DESC, rede_heuristica;

-- ---------------------------------------------------------------------------
-- 2) Mesmo relatório, só Grande SP (ajuste cidade/UF conforme seu cadastro)
-- ---------------------------------------------------------------------------
WITH classified AS (
  SELECT
    id,
    name,
    city,
    CASE
      WHEN name ILIKE '%carrefour%' OR name ILIKE '%atacadão%' OR name ILIKE '%atacadao%' THEN 'carrefour_atacadao'
      WHEN name ILIKE '%assai%' OR name ILIKE '%assaí%' THEN 'assai'
      WHEN name ILIKE '%pão de açúcar%' OR name ILIKE '%pao de acucar%' OR name ILIKE '%minuto pao%' THEN 'paodeacucar'
      WHEN name ILIKE '%dia %' OR name ILIKE 'dia %' OR name ILIKE '% dia %' OR name ILIKE '%supermercado dia%' THEN 'dia'
      WHEN name ILIKE '%hirota%' THEN 'hirota'
      WHEN name ILIKE '%lopes%' THEN 'lopes'
      WHEN name ILIKE '%são jorge%' OR name ILIKE '%sao jorge%' OR name ILIKE '%sacolão%' OR name ILIKE '%sacolao%' THEN 'saojorge'
      WHEN name ILIKE '%mambo%' THEN 'mambo'
      WHEN name ILIKE '%agape%' OR name ILIKE '%ágape%' THEN 'agape'
      WHEN name ILIKE '%armazém do campo%' OR name ILIKE '%armazem do campo%' THEN 'armazemdocampo'
      ELSE 'outros'
    END AS rede_heuristica
  FROM public.stores
  WHERE COALESCE(active, true) = true
    AND (
      city ILIKE '%são paulo%'
      OR city ILIKE '%sao paulo%'
      OR neighborhood ILIKE '%são paulo%'
    )
)
SELECT
  rede_heuristica,
  COUNT(*) AS lojas
FROM classified
GROUP BY 1
ORDER BY lojas DESC;

-- ---------------------------------------------------------------------------
-- 3) Promoções do agente (últimas 72h) por campo supermercado
-- ---------------------------------------------------------------------------
SELECT
  supermercado,
  COUNT(*) AS linhas,
  MAX(atualizado_em) AS ultimo_run
FROM public.promocoes_supermercados
WHERE ativo = true
  AND expira_em > now()
  AND atualizado_em > now() - interval '72 hours'
GROUP BY 1
ORDER BY linhas DESC;

-- ---------------------------------------------------------------------------
-- 4) price_points “promo” recentes (24h) — comunidade + imports (categoria com promo)
-- ---------------------------------------------------------------------------
SELECT
  COALESCE(store_name, '(sem loja)') AS loja,
  COUNT(*) AS pontos
FROM public.price_points
WHERE created_at > now() - interval '24 hours'
  AND lat IS NOT NULL
  AND lng IS NOT NULL
  AND (
    lower(coalesce(category, '')) LIKE '%promo%'
    OR lower(coalesce(id::text, '')) LIKE 'promo-%'
  )
GROUP BY 1
ORDER BY pontos DESC
LIMIT 40;
