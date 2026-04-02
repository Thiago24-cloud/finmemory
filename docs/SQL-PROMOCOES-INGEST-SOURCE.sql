-- =============================================================================
-- FinMemory — Coluna ingest_source em promocoes_supermercados
-- Copiar e colar no Supabase → SQL Editor (é idempotente).
-- =============================================================================

ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS ingest_source TEXT;

COMMENT ON COLUMN public.promocoes_supermercados.ingest_source IS
  'Origem do lote: ex. finmemory_agent:assai, job_openai_dia. Métricas por canal; desativação por run continua por supermercado.';

CREATE INDEX IF NOT EXISTS idx_promocoes_ingest_source_ativo
  ON public.promocoes_supermercados (ingest_source, supermercado)
  WHERE ativo = true;

-- ---------------------------------------------------------------------------
-- Opcional: marcar linhas antigas (antes da coluna existir) para relatórios
-- ---------------------------------------------------------------------------
-- UPDATE public.promocoes_supermercados
-- SET ingest_source = 'legacy_unknown'
-- WHERE ingest_source IS NULL;

-- ---------------------------------------------------------------------------
-- Exemplo: volume ativo por canal e rede
-- ---------------------------------------------------------------------------
-- SELECT ingest_source, supermercado, count(*) AS n
-- FROM public.promocoes_supermercados
-- WHERE ativo = true AND expira_em > now()
-- GROUP BY 1, 2
-- ORDER BY n DESC;
