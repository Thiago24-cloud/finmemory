-- Identidade da instituição (Open Finance) por linha de transação para UI consistente em todo o app.

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS institution_connector_id TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_account_id TEXT,
  ADD COLUMN IF NOT EXISTS credit_institution_name TEXT,
  ADD COLUMN IF NOT EXISTS credit_institution_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_icon_url TEXT;

COMMENT ON COLUMN public.transacoes.institution_name IS 'Nome da instituição (Pluggy connector / conta de origem) para tema e ícones.';
COMMENT ON COLUMN public.transacoes.institution_logo_url IS 'URL do logo institucional (Open Finance); prioridade sobre fallbacks.';
COMMENT ON COLUMN public.transacoes.institution_connector_id IS 'Pluggy connector.id ligado ao item da importação.';
COMMENT ON COLUMN public.transacoes.pluggy_account_id IS 'ID da conta Pluggy (account.id) quando source=pluggy.';
COMMENT ON COLUMN public.transacoes.credit_institution_name IS 'Banco emissor do cartão (quando disponível no pipeline Open Finance).';
COMMENT ON COLUMN public.transacoes.credit_institution_logo_url IS 'Logo do emissor do cartão (conferência com extrato).';
COMMENT ON COLUMN public.transacoes.custom_icon_url IS 'Ícone opcional definido pelo utilizador (transações manuais ou override).';
