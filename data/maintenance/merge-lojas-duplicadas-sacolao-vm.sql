-- =============================================================================
-- Unificar duas linhas em public.stores (Sacolão São Jorge — Vila Madalena duplicado).
--
-- Antes (produção): aplica migrações na ordem do repo, especialmente
--   supabase/migrations/20260328120000_stores_cnpj_unique_normalized.sql (coluna cnpj)
--   e 20260410130000_find_or_create_store_cnpj.sql (RPC com match por CNPJ).
-- Não uses UNIQUE(cnpj) “cego” — vários NULL quebram ou não deduplicam; o índice
-- parcial com 14 dígitos já está na migração 20260328120000.
--
-- IMPORTANTE — Supabase / Postgres:
-- • Comandos em INGLÊS: UPDATE, SET, WHERE, DELETE, RETURNING, SELECT.
-- • Tabela de lojas: public.stores (plural).
-- • Fila de encartes: public.encarte_queue (se existir).
-- =============================================================================

-- (Opcional) CNPJ no futuro:
-- ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- -----------------------------------------------------------------------------
-- 0) Listar candidatos
-- -----------------------------------------------------------------------------
SELECT id, name, address, lat, lng, active
FROM public.stores
WHERE active = true
  AND (
    name ILIKE '%Sacolão%São Jorge%'
    OR name ILIKE '%Sacolao%Sao Jorge%'
    OR (name ILIKE '%São Jorge%' AND name ILIKE '%Sacol%')
  )
ORDER BY name;

-- -----------------------------------------------------------------------------
-- A) Merge automático (só corre se existirem EXATAMENTE 2 lojas Sacolão Jorge
--    na caixa Vila Madalena; escolhe KEEPER por nome "Vila Madalena"/"Castela"
--    e depois pela menor distância ao ponto oficial da curadoria).
--    Define perform_merge := true para aplicar; false só mostra NOTICE com ids.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  perform_merge boolean := false;
  official_lat double precision := -23.5505;
  official_lng double precision := -46.6833;
  n_cands int;
  keeper_id uuid;
  drop_id uuid;
BEGIN
  WITH cands AS (
    SELECT
      s.id,
      s.name,
      s.address,
      s.lat,
      s.lng,
      sqrt(
        power(s.lat::double precision - official_lat, 2)
        + power(s.lng::double precision - official_lng, 2)
      ) AS dist_deg
    FROM public.stores s
    WHERE s.active = true
      AND (
        s.name ILIKE '%Sacolão%São Jorge%'
        OR s.name ILIKE '%Sacolao%Sao Jorge%'
        OR (s.name ILIKE '%São Jorge%' AND s.name ILIKE '%Sacol%')
      )
      AND s.lat BETWEEN -23.58 AND -23.52
      AND s.lng BETWEEN -46.72 AND -46.66
  ),
  ranked AS (
    SELECT
      c.id,
      c.name,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN c.name ILIKE '%Vila Madalena%' THEN 0
            WHEN c.name ILIKE '%Castela%' OR c.address ILIKE '%Castela%' THEN 1
            ELSE 2
          END,
          c.dist_deg,
          c.name
      ) AS rn
    FROM cands c
  )
  SELECT
    (SELECT count(*)::int FROM cands),
    (SELECT r.id FROM ranked r WHERE r.rn = 1),
    (SELECT r.id FROM ranked r WHERE r.rn = 2)
  INTO n_cands, keeper_id, drop_id;

  IF n_cands IS NULL OR n_cands <> 2 OR keeper_id IS NULL OR drop_id IS NULL THEN
    RAISE NOTICE 'merge-sacolao-vm: esperadas 2 lojas na caixa VM; encontradas %. Nada alterado.', COALESCE(n_cands, 0);
    RETURN;
  END IF;

  RAISE NOTICE 'merge-sacolao-vm: keeper=% drop=%', keeper_id, drop_id;

  IF NOT perform_merge THEN
    RAISE NOTICE 'merge-sacolao-vm: define perform_merge := true no bloco para aplicar UPDATE/DELETE.';
    RETURN;
  END IF;

  UPDATE public.promotions
  SET store_id = keeper_id
  WHERE store_id = drop_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'encarte_queue'
  ) THEN
    UPDATE public.encarte_queue
    SET store_id = keeper_id
    WHERE store_id = drop_id;
  END IF;

  DELETE FROM public.stores
  WHERE id = drop_id;

  RAISE NOTICE 'merge-sacolao-vm: concluído (promotions + encarte_queue + stores).';
END $$;

-- -----------------------------------------------------------------------------
-- B) Manual — substituir KEEPER_UUID_AQUI e DROP_UUID_AQUI pelos UUIDs do SELECT 0)
-- -----------------------------------------------------------------------------

/*
UPDATE public.promotions
SET store_id = 'KEEPER_UUID_AQUI'::uuid
WHERE store_id = 'DROP_UUID_AQUI'::uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'encarte_queue'
  ) THEN
    UPDATE public.encarte_queue
    SET store_id = 'KEEPER_UUID_AQUI'::uuid
    WHERE store_id = 'DROP_UUID_AQUI'::uuid;
  END IF;
END $$;

DELETE FROM public.stores
WHERE id = 'DROP_UUID_AQUI'::uuid
RETURNING id, name, address;
*/

-- -----------------------------------------------------------------------------
-- B2) Produção — UUIDs confirmados (duas linhas, mesmo endereço Castela 33)
--     KEEPER: Sacolão São Jorge - Vila Madalena (nome completo)
--     DROP:   Sacolão São Jorge (duplicata)
--     Validar com SELECT antes; depois descomentar e executar em bloco.
--
--     Nota: em Postgres use DELETE FROM … WHERE … (não "EXCLUIR DE" / "ONDE").
-- -----------------------------------------------------------------------------

/*
-- Pré-check (opcional):
-- SELECT id, store_id FROM public.promotions WHERE store_id IN (
--   '0ff617d9-c37b-4cb7-ab5a-0188b78395c6'::uuid,
--   '0059daab-f935-44bd-b2fa-c5f2f2847379'::uuid
-- );

BEGIN;

UPDATE public.promotions
SET store_id = '0ff617d9-c37b-4cb7-ab5a-0188b78395c6'::uuid
WHERE store_id = '0059daab-f935-44bd-b2fa-c5f2f2847379'::uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'encarte_queue'
  ) THEN
    UPDATE public.encarte_queue
    SET store_id = '0ff617d9-c37b-4cb7-ab5a-0188b78395c6'::uuid
    WHERE store_id = '0059daab-f935-44bd-b2fa-c5f2f2847379'::uuid;
  END IF;
END $$;

DELETE FROM public.stores
WHERE id = '0059daab-f935-44bd-b2fa-c5f2f2847379'::uuid
RETURNING id, name, address;

COMMIT;
*/

-- -----------------------------------------------------------------------------
-- C) Coordenadas oficiais VM (opcional)
-- -----------------------------------------------------------------------------
/*
UPDATE public.stores
SET
  lat = -23.5505::double precision,
  lng = -46.6833::double precision,
  address = 'Rua Isabel de Castela, 33 — Vila Madalena, São Paulo, SP'
WHERE id = '0ff617d9-c37b-4cb7-ab5a-0188b78395c6'::uuid;
*/

-- -----------------------------------------------------------------------------
-- D) Remover demo saojorge (segundo preço artificial no mapa)
-- -----------------------------------------------------------------------------
/*
DELETE FROM public.promocoes_supermercados
WHERE ingest_source = 'demo_seed:redes_mapa:v1'
  AND supermercado = 'saojorge';
*/
