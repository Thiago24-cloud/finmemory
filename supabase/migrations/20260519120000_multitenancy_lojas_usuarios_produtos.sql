-- Multitenancy FinMemory Parceiros: lojas, usuarios_loja, produtos_loja + RLS.
--
-- ATENÇÃO: public.produtos já existe no FinMemory (itens de NF-e / transacao_id).
-- O catálogo do lojista fica em public.produtos_loja (coluna loja_id = tenant).

-- ---------------------------------------------------------------------------
-- 1) Lojas (tenants) — extensão de public.stores + view legível "lojas"
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS tempo_preparo_medio integer NOT NULL DEFAULT 15;

COMMENT ON COLUMN public.stores.tempo_preparo_medio IS
  'Minutos médios de preparo (pick-up / ETA na cozinha).';

DROP VIEW IF EXISTS public.lojas;

CREATE VIEW public.lojas AS
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
  'Tenants do FinMemory Parceiros (espelho de public.stores).';

-- ---------------------------------------------------------------------------
-- 2) usuarios_loja
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios_loja (
  id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  cargo text NOT NULL DEFAULT 'dono'
    CHECK (cargo IN ('dono', 'gerente', 'funcionario')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_loja_loja_id ON public.usuarios_loja (loja_id);

COMMENT ON TABLE public.usuarios_loja IS
  'Quem gere cada loja. No login, resolve loja_id para filtrar produtos_loja.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'merchant_store_profiles'
  ) THEN
    INSERT INTO public.usuarios_loja (id, loja_id, cargo, updated_at)
    SELECT m.user_id, m.store_id, 'dono', now()
    FROM public.merchant_store_profiles m
    ON CONFLICT (id) DO UPDATE SET
      loja_id = EXCLUDED.loja_id,
      updated_at = now();
  END IF;
END $$;

INSERT INTO public.usuarios_loja (id, loja_id, cargo, updated_at)
SELECT s.owner_user_id, s.id, 'dono', now()
FROM public.stores s
WHERE s.owner_user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) produtos_loja — catálogo/ofertas do lojista (NÃO usar public.produtos = NF-e)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  preco_original numeric(14, 2),
  preco_oferta numeric(14, 2) NOT NULL CHECK (preco_oferta >= 0),
  em_oferta boolean NOT NULL DEFAULT true,
  quantidade_estoque integer,
  url_imagem text,
  status_disponivel boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_loja_loja_oferta
  ON public.produtos_loja (loja_id, em_oferta, status_disponivel, created_at DESC);

COMMENT ON TABLE public.produtos_loja IS
  'Catálogo multitenancy do parceiro. Equivalente ao blueprint "produtos" com loja_id.';

-- Migrar merchant_products → produtos_loja (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'merchant_products'
  ) THEN
    INSERT INTO public.produtos_loja (
      loja_id, nome, descricao, preco_original, preco_oferta,
      em_oferta, url_imagem, status_disponivel, created_at, updated_at
    )
    SELECT
      mp.store_id,
      mp.name,
      mp.description,
      mp.price,
      mp.price,
      true,
      mp.image_url,
      COALESCE(mp.active, true),
      mp.created_at,
      COALESCE(mp.updated_at, mp.created_at)
    FROM public.merchant_products mp
    WHERE NOT EXISTS (
      SELECT 1 FROM public.produtos_loja p
      WHERE p.loja_id = mp.store_id
        AND p.nome = mp.name
        AND p.preco_oferta = mp.price
        AND p.created_at = mp.created_at
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) PostGIS + índice geográfico em stores (feed por raio)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) Consulta geo — ofertas a até N km (SECURITY DEFINER: feed ignora RLS de tenant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.produtos_oferta_proximos(
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

COMMENT ON FUNCTION public.produtos_oferta_proximos IS
  'Ofertas ativas (produtos_loja) de lojas num raio (km). Bypass RLS via SECURITY DEFINER; filtros no WHERE.';

GRANT SELECT ON public.produtos_loja TO anon, authenticated;
GRANT SELECT ON public.usuarios_loja TO authenticated;

REVOKE ALL ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produtos_oferta_proximos(double precision, double precision, double precision)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) RLS — helper (evita subquery repetida por linha)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.usuarios_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_loja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_loja_select_own ON public.usuarios_loja;
CREATE POLICY usuarios_loja_select_own ON public.usuarios_loja
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS usuarios_loja_update_own ON public.usuarios_loja;
CREATE POLICY usuarios_loja_update_own ON public.usuarios_loja
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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

-- public = anon + authenticated: feed de ofertas visível mesmo com lojista logado
DROP POLICY IF EXISTS produtos_loja_select_ofertas_publicas ON public.produtos_loja;
CREATE POLICY produtos_loja_select_ofertas_publicas ON public.produtos_loja
  FOR SELECT TO public
  USING (em_oferta = true AND status_disponivel = true);
