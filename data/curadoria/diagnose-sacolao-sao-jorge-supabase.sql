-- Diagnóstico: Sacolão São Jorge — loja, promotions e agente (cole no SQL Editor do Supabase)
-- Critério "elegível para o pin hoje" ≈ isPromotionEligibleForMapPin (America/Sao_Paulo).

-- 1) Lojas candidatas
SELECT id, name, address, lat, lng
FROM public.stores
WHERE active = true
  AND (
    name ILIKE '%Sacolão%Jorge%'
    OR name ILIKE '%Sacolao%Jorge%'
    OR (name ILIKE '%São Jorge%' AND name ILIKE '%Sacol%')
  )
ORDER BY name;

-- 2) Contagens por store_id (substitua o UUID se só quiser Vila Madalena)
WITH sp AS (
  SELECT (timezone('America/Sao_Paulo', now()))::date AS today_sp
),
stores_jorge AS (
  SELECT id, name
  FROM public.stores
  WHERE active = true
    AND (name ILIKE '%Sacolão%Jorge%' OR name ILIKE '%Sacolao%Jorge%')
)
SELECT
  s.name AS store_name,
  s.id AS store_id,
  count(p.id) AS total_promotions_rows,
  count(*) FILTER (
    WHERE p.active = true AND p.is_individual_product = true
  ) AS api_like_active_individual,
  count(*) FILTER (
    WHERE p.active = true
      AND p.is_individual_product = true
      AND (
        (
          (p.valid_dates IS NULL OR cardinality(p.valid_dates) = 0)
          AND (p.valid_from IS NULL OR p.valid_from <= sp.today_sp)
          AND (p.valid_until IS NULL OR p.valid_until >= sp.today_sp)
        )
        OR (
          cardinality(p.valid_dates) > 0
          AND sp.today_sp >= (SELECT min(vd::date) FROM unnest(p.valid_dates) AS vd)
          AND sp.today_sp <= (SELECT max(vd::date) FROM unnest(p.valid_dates) AS vd)
        )
      )
  ) AS eligible_map_pin_today
FROM stores_jorge s
LEFT JOIN public.promotions p ON p.store_id = s.id
CROSS JOIN sp
GROUP BY s.id, s.name
ORDER BY s.name;

-- 3) Amostra elegível hoje (painel / GET store-offers → promotions[])
WITH sp AS (
  SELECT (timezone('America/Sao_Paulo', now()))::date AS today_sp
)
SELECT
  p.id,
  s.name AS store_name,
  p.product_name,
  p.promo_price,
  p.valid_from,
  p.valid_until,
  p.valid_dates,
  p.active,
  p.is_individual_product
FROM public.promotions p
JOIN public.stores s ON s.id = p.store_id
CROSS JOIN sp
WHERE s.active = true
  AND (s.name ILIKE '%Sacolão%Jorge%' OR s.name ILIKE '%Sacolao%Jorge%')
  AND p.active = true
  AND p.is_individual_product = true
  AND (
    (
      (p.valid_dates IS NULL OR cardinality(p.valid_dates) = 0)
      AND (p.valid_from IS NULL OR p.valid_from <= sp.today_sp)
      AND (p.valid_until IS NULL OR p.valid_until >= sp.today_sp)
    )
    OR (
      cardinality(p.valid_dates) > 0
      AND sp.today_sp >= (SELECT min(vd::date) FROM unnest(p.valid_dates) AS vd)
      AND sp.today_sp <= (SELECT max(vd::date) FROM unnest(p.valid_dates) AS vd)
    )
  )
ORDER BY s.name, p.product_name
LIMIT 30;

-- 4) Agente: saojorge perto da Vila Madalena (~coords curadoria) ainda não expirado
SELECT
  count(*) AS cnt,
  min(expira_em) AS min_expira,
  max(expira_em) AS max_expira
FROM public.promocoes_supermercados
WHERE ativo = true
  AND supermercado = 'saojorge'
  AND expira_em > now()
  AND lat BETWEEN -23.63 AND -23.47
  AND lng BETWEEN -46.76 AND -46.61;

SELECT id, nome_produto, preco, lat, lng, expira_em
FROM public.promocoes_supermercados
WHERE ativo = true
  AND supermercado = 'saojorge'
  AND expira_em > now()
  AND lat BETWEEN -23.63 AND -23.47
  AND lng BETWEEN -46.76 AND -46.61
ORDER BY expira_em DESC
LIMIT 15;
