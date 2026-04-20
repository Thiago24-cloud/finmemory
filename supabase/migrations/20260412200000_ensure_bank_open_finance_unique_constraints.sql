-- Garante UNIQUE em (user_id, pluggy_account_id) e (user_id, pluggy_transaction_id)
-- para ambientes onde as tabelas existiam sem a migração 20260410200000 completa.
-- O PostgREST só aplica upsert/onConflict de forma fiável com constraint único nessas colunas.
--
-- Se algum ALTER falhar (23505), há linhas duplicadas: correr primeiro os SELECTs em
-- scripts/sql/pluggy-dedup-diagnostics.sql e limpar antes de repetir esta migração.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'bank_accounts'
      AND c.conname = 'bank_accounts_user_pluggy_account_unique'
  ) THEN
    ALTER TABLE public.bank_accounts
      ADD CONSTRAINT bank_accounts_user_pluggy_account_unique
      UNIQUE (user_id, pluggy_account_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'bank_transactions'
      AND c.conname = 'bank_transactions_user_pluggy_tx_unique'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_user_pluggy_tx_unique
      UNIQUE (user_id, pluggy_transaction_id);
  END IF;
END $$;
