-- Idempotência na importação Open Finance (Pluggy)

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT;

COMMENT ON COLUMN public.transacoes.pluggy_transaction_id IS 'ID da transação na Pluggy; evita duplicados ao re-sincronizar';

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_user_pluggy_tx_unique
  ON public.transacoes(user_id, pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;
