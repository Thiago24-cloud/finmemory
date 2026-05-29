-- Importação controlada de insumos (Parceiros): revisão pendente + lotes CSV/ERP.

ALTER TABLE public.insumos_loja
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS status_revisao text NOT NULL DEFAULT 'aprovado'
    CHECK (status_revisao IN ('pendente', 'aprovado')),
  ADD COLUMN IF NOT EXISTS import_lote_id uuid;

CREATE INDEX IF NOT EXISTS idx_insumos_loja_sku
  ON public.insumos_loja (loja_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insumos_loja_status_revisao
  ON public.insumos_loja (loja_id, status_revisao, created_at DESC);

CREATE TABLE IF NOT EXISTS public.insumos_import_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'csv' CHECK (origem IN ('csv', 'erp_api', 'erp_csv')),
  nome_arquivo text,
  erp_url text,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_linhas integer NOT NULL DEFAULT 0,
  linhas_validas integer NOT NULL DEFAULT 0,
  linhas_erro integer NOT NULL DEFAULT 0,
  insights jsonb,
  status text NOT NULL DEFAULT 'pendente_revisao'
    CHECK (status IN ('pendente_revisao', 'confirmado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_insumos_import_lotes_loja
  ON public.insumos_import_lotes (loja_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insumos_loja_import_lote_id_fkey'
  ) THEN
    ALTER TABLE public.insumos_loja
      ADD CONSTRAINT insumos_loja_import_lote_id_fkey
      FOREIGN KEY (import_lote_id) REFERENCES public.insumos_import_lotes (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.insumos_loja.status_revisao IS
  'pendente = importado aguardando OK do lojista; aprovado = ativo no estoque.';
COMMENT ON TABLE public.insumos_import_lotes IS
  'Lote de importação CSV/ERP — itens ficam pendente_revisao até confirmação.';

ALTER TABLE public.insumos_import_lotes ENABLE ROW LEVEL SECURITY;
