-- Canal técnico de ingestão (métricas, debugging). O agente preenche finmemory_agent:<rede>.

ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS ingest_source TEXT;

COMMENT ON COLUMN public.promocoes_supermercados.ingest_source IS
  'Origem do lote: ex. finmemory_agent:assai, job_openai_dia. Desativação por rede continua global ao supermercado.';

CREATE INDEX IF NOT EXISTS idx_promocoes_ingest_source_ativo
  ON public.promocoes_supermercados (ingest_source, supermercado)
  WHERE ativo = true;
