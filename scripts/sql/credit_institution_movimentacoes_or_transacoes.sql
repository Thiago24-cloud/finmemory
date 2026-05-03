-- FinMemory usa `public.transacoes`. Se no teu fork a tabela chama-se `movimentacoes`,
-- troca só o nome no ALTER abaixo.
--
-- Colunas mínimas pedidas pelo pack (emissor cartão):
--   credit_institution_name, credit_institution_logo_url
--
-- (Opcional recomendado no FinMemory upstream — logos conta / Open Finance.)
-- institution_name, institution_logo_url, institution_connector_id,
-- pluggy_account_id, custom_icon_url já estão em:
-- supabase/migrations/20260503120000_transacoes_institution_open_finance.sql

-- Variante nome do cliente: movimentações
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS credit_institution_name TEXT,
  ADD COLUMN IF NOT EXISTS credit_institution_logo_url TEXT;

-- Variante FinnMemory atual
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS credit_institution_name TEXT,
  ADD COLUMN IF NOT EXISTS credit_institution_logo_url TEXT;
