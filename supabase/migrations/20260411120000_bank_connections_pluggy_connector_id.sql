-- Instituição Pluggy por item (connector.id): permite substituir reconexões do mesmo banco
-- sem acumular várias linhas em bank_accounts para o mesmo utilizador.

ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS pluggy_connector_id INTEGER NULL;

COMMENT ON COLUMN public.bank_connections.pluggy_connector_id IS 'Pluggy connector.id do item; usado para remover items antigos da mesma instituição ao reconectar';

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_connector
  ON public.bank_connections(user_id, pluggy_connector_id)
  WHERE pluggy_connector_id IS NOT NULL;
