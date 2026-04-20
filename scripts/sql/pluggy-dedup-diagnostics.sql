-- FinMemory — diagnóstico Pluggy / duplicatas
-- Correr no Supabase SQL Editor (produção). Não altera dados salvo secção "Limpeza" no fim.
--
-- Índice único: a migração 20260411190000 substitui o índice parcial por um único em
-- (user_id, pluggy_transaction_id) sem WHERE, para o PostgREST aceitar upsert onConflict.

-- ---------------------------------------------------------------------------
-- 1) Índice único em transacoes (import Pluggy → histórico do app)
-- ---------------------------------------------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'transacoes'
  AND indexdef ILIKE '%pluggy%';

-- Duplicatas lógicas (não devia haver linhas se o índice único estiver ativo)
SELECT user_id, pluggy_transaction_id, count(*) AS n
FROM public.transacoes
WHERE pluggy_transaction_id IS NOT NULL
GROUP BY 1, 2
HAVING count(*) > 1;

-- Transações Pluggy sem id (não entram no índice parcial — podem duplicar visualmente)
SELECT count(*) AS transacoes_pluggy_sem_pluggy_id
FROM public.transacoes
WHERE source = 'pluggy'
  AND (pluggy_transaction_id IS NULL OR btrim(pluggy_transaction_id) = '');

-- ---------------------------------------------------------------------------
-- 2) Espelho Open Finance: bank_accounts / bank_transactions
-- ---------------------------------------------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.bank_accounts'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;

SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.bank_transactions'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;

-- Mesmo pluggy_account_id duas vezes para o mesmo user (não devia existir)
SELECT user_id, pluggy_account_id, count(*) AS n
FROM public.bank_accounts
GROUP BY 1, 2
HAVING count(*) > 1;

-- "Duplicatas visuais": mesmo nome + saldo, mas item/conta Pluggy diferentes —
-- típico de vários bank_connections (várias ligações ao mesmo banco). O UNIQUE
-- (user_id, pluggy_account_id) não impede isto: cada item_id traz IDs de conta distintos.
SELECT
  ba.user_id,
  ba.name,
  ba.balance,
  count(*) AS n_linhas,
  array_agg(ba.item_id ORDER BY ba.item_id) AS item_ids,
  array_agg(ba.pluggy_account_id ORDER BY ba.pluggy_account_id) AS pluggy_account_ids
FROM public.bank_accounts ba
GROUP BY ba.user_id, ba.name, ba.balance
HAVING count(*) > 1
ORDER BY n_linhas DESC;

-- Mesmo pluggy_transaction_id duas vezes para o mesmo user em bank_transactions
SELECT user_id, pluggy_transaction_id, count(*) AS n
FROM public.bank_transactions
GROUP BY 1, 2
HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- 3) Conexões: coluna pluggy_connector_id (prune por instituição)
-- ---------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bank_connections'
  AND column_name = 'pluggy_connector_id';

-- Vários items por utilizador (normal se forem bancos diferentes; suspeito se só um banco)
SELECT user_id, count(*) AS n_connections
FROM public.bank_connections
GROUP BY 1
ORDER BY n_connections DESC;

-- ---------------------------------------------------------------------------
-- 4) Limpeza opcional — contas sem linha em bank_connections (órfãs)
-- Descomenta só se analisares o SELECT antes e fizer sentido.
-- ---------------------------------------------------------------------------
-- SELECT ba.user_id, ba.item_id, count(*) AS n_accounts
-- FROM public.bank_accounts ba
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.bank_connections bc
--   WHERE bc.user_id = ba.user_id AND bc.item_id = ba.item_id
-- )
-- GROUP BY 1, 2;
--
-- DELETE FROM public.bank_accounts ba
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.bank_connections bc
--   WHERE bc.user_id = ba.user_id AND bc.item_id = ba.item_id
-- );
