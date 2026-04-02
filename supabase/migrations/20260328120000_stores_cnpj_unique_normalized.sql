-- Identidade fiscal da unidade para match entre fontes (NFC-e, Receita, etc.).
-- Unicidade apenas quando há exatamente 14 dígitos após normalização.

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cnpj TEXT;

COMMENT ON COLUMN public.stores.cnpj IS
  'CNPJ do estabelecimento (com ou sem máscara). Unicidade no índice usa só os 14 dígitos.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_cnpj_normalized_unique
  ON public.stores ((regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g')))
  WHERE length(regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g')) = 14;
