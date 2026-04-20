-- O índice único parcial (WHERE pluggy_transaction_id IS NOT NULL) não é inferível
-- como alvo de ON CONFLICT no PostgreSQL, pelo que o .upsert() do PostgREST não deduplica.
-- Índice único em (user_id, pluggy_transaction_id) sem WHERE: várias linhas com NULL em
-- pluggy_transaction_id continuam permitidas (NULL ≠ NULL em UNIQUE no Postgres).

DROP INDEX IF EXISTS public.transacoes_user_pluggy_tx_unique;

CREATE UNIQUE INDEX transacoes_user_pluggy_tx_unique
  ON public.transacoes (user_id, pluggy_transaction_id);

COMMENT ON INDEX public.transacoes_user_pluggy_tx_unique IS
  'Unicidade Pluggy por utilizador; permite upsert onConflict(user_id, pluggy_transaction_id)';
