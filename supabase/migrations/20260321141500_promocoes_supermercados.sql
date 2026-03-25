-- Catálogo de promoções coletadas pelo job (agent.js). TTL no app: expira_em (ex.: 72h após o run).
-- Substituição por loja: desativa lote anterior (ativo = false) e insere novo lote com run_id.

CREATE TABLE IF NOT EXISTS public.promocoes_supermercados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermercado TEXT NOT NULL,
  store_key TEXT NOT NULL DEFAULT 'default',
  store_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  run_id TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promocoes_supermercado_store_ativo
  ON public.promocoes_supermercados (supermercado, store_key)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_promocoes_expira_ativo
  ON public.promocoes_supermercados (expira_em)
  WHERE ativo = true;

ALTER TABLE public.promocoes_supermercados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promocoes_select_valid" ON public.promocoes_supermercados;
CREATE POLICY "promocoes_select_valid"
  ON public.promocoes_supermercados FOR SELECT
  USING (ativo = true AND expira_em > NOW());

COMMENT ON TABLE public.promocoes_supermercados IS
  'Promoções por supermercado/loja; job marca run_id e expira_em; app filtra ativo e expira_em > now()';
