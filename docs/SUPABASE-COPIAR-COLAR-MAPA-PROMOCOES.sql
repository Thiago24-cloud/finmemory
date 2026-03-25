-- =============================================================================
-- FinMemory — Copiar e colar no Supabase (SQL Editor)
-- Mapa + agente de promoções (promocoes_supermercados) + coluna DIA por loja
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================================

-- Pré-requisito: public.stores e public.price_points (se usar índice do item 3).

-- ---------------------------------------------------------------------------
-- 1) Lojas no mapa: URL opcional da página DIA (por unidade)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS promo_page_url TEXT;

COMMENT ON COLUMN public.stores.promo_page_url IS
  'Opcional: URL da loja no site DIA (ex. https://www.dia.com.br/lojas/...).';

-- ---------------------------------------------------------------------------
-- 2) Promoções do agente (Playwright) — schema usado pelo finmemory-agent e pela API /api/map/points
--    Se já existir tabela com outro formato (ex. product_name), ajuste manualmente antes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promocoes_supermercados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supermercado    text NOT NULL,
  nome_produto    text NOT NULL,
  preco           numeric(10, 2),
  preco_original  text,
  imagem_url      text,
  validade        date,
  lat             numeric(10, 7),
  lng             numeric(10, 7),
  run_id          text NOT NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em       timestamptz NOT NULL,
  ativo           boolean NOT NULL DEFAULT true
);

-- Colunas que podem faltar em bases antigas
ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS nome_produto text,
  ADD COLUMN IF NOT EXISTS preco numeric(10, 2),
  ADD COLUMN IF NOT EXISTS preco_original text,
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS validade date,
  ADD COLUMN IF NOT EXISTS lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS run_id text,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_promocoes_supermercado_nome_run_unique
  ON public.promocoes_supermercados (supermercado, nome_produto, run_id);

CREATE INDEX IF NOT EXISTS idx_promo_supermercado ON public.promocoes_supermercados (supermercado);
CREATE INDEX IF NOT EXISTS idx_promo_ativo ON public.promocoes_supermercados (ativo);
CREATE INDEX IF NOT EXISTS idx_promo_expira ON public.promocoes_supermercados (expira_em DESC);
CREATE INDEX IF NOT EXISTS idx_promo_run_id ON public.promocoes_supermercados (run_id);
CREATE INDEX IF NOT EXISTS idx_promocoes_supermercados_lat_lng_active
  ON public.promocoes_supermercados (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND ativo = true;

ALTER TABLE public.promocoes_supermercados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promocoes_select_valid" ON public.promocoes_supermercados;
DROP POLICY IF EXISTS "Anon pode ler promoções" ON public.promocoes_supermercados;
DROP POLICY IF EXISTS "Usuários autenticados podem ler promoções" ON public.promocoes_supermercados;

CREATE POLICY "promocoes_select_anon"
  ON public.promocoes_supermercados FOR SELECT TO anon
  USING (ativo = true AND expira_em > now());

CREATE POLICY "promocoes_select_authenticated"
  ON public.promocoes_supermercados FOR SELECT TO authenticated
  USING (ativo = true AND expira_em > now());

COMMENT ON TABLE public.promocoes_supermercados IS
  'Promoções do agente; service role ignora RLS para insert/update.';

-- ---------------------------------------------------------------------------
-- 3) Mapa: acelera price_points por bbox (se a tabela existir)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'price_points'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_price_points_lat_lng_partial
      ON public.price_points (lat, lng)
      WHERE lat IS NOT NULL AND lng IS NOT NULL;
  END IF;
END $$;

-- =============================================================================
-- Fim. Depois: npm run promo:dia-env (gera URLs DIA) e npm run promo:agent
-- =============================================================================
