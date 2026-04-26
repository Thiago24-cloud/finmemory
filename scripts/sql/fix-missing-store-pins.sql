-- ============================================================
-- FinMemory — Diagnóstico e correção de pins sumidos no mapa
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Verificar status dos estabelecimentos
SELECT
  id,
  name,
  type,
  lat,
  lng,
  active,
  address
FROM stores
WHERE
  LOWER(name) LIKE '%burger king%'
  OR LOWER(name) LIKE '%bela madalena%'
ORDER BY name;

-- ============================================================
-- 2. Reativar lojas com active = false / NULL
-- ============================================================
UPDATE stores
SET active = true
WHERE
  (
    LOWER(name) LIKE '%burger king%'
    OR LOWER(name) LIKE '%bela madalena%'
  )
  AND (active IS NULL OR active = false);

-- ============================================================
-- 3. Verificar lat/lng NULL ou zerados
-- ============================================================
SELECT id, name, lat, lng
FROM stores
WHERE
  (
    LOWER(name) LIKE '%burger king%'
    OR LOWER(name) LIKE '%bela madalena%'
  )
  AND (lat IS NULL OR lng IS NULL OR lat = 0 OR lng = 0);

-- ============================================================
-- 4. Bela Madalena — padarias (type='bakery') só aparecem no
--    mapa se tiverem oferta recente (price_points nas últimas
--    24h). Solução: mudar type para 'restaurant' → sempre visível.
-- ============================================================
UPDATE stores
SET type = 'restaurant'
WHERE LOWER(name) LIKE '%bela madalena%'
  AND type IN ('bakery', 'padaria');

-- ============================================================
-- 5. Verificar price_points recentes para forçar oferta_hoje
-- ============================================================
SELECT
  s.name,
  s.type,
  s.active,
  COUNT(pp.id) AS price_points_48h
FROM stores s
LEFT JOIN price_points pp
  ON pp.store_name = s.name
  AND pp.created_at >= NOW() - INTERVAL '48 hours'
  AND pp.source IN ('bot_fila_aprovado', 'admin_manual', 'community_manual')
WHERE
  LOWER(s.name) LIKE '%burger king%'
  OR LOWER(s.name) LIKE '%bela madalena%'
GROUP BY s.id, s.name, s.type, s.active;

-- ============================================================
-- 6. (Opcional) Verificar se photo_url / logo_url estão OK
-- ============================================================
SELECT id, name, photo_url
FROM stores
WHERE
  (
    LOWER(name) LIKE '%burger king%'
    OR LOWER(name) LIKE '%bela madalena%'
  )
  AND photo_url IS NOT NULL;
