-- ============================================================
-- FinMemory — Defaults de plano e RLS por plano
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Garantir valor padrão 'free' para novos usuários
ALTER TABLE users
  ALTER COLUMN plano SET DEFAULT 'free';

ALTER TABLE users
  ALTER COLUMN plano_ativo SET DEFAULT false;

-- Corrigir usuários sem plano definido (migração de dados)
UPDATE users
SET plano = 'free', plano_ativo = false
WHERE plano IS NULL OR plano = '';

-- Adicionar constraint de validação
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_plano_check;

ALTER TABLE users
  ADD CONSTRAINT users_plano_check
  CHECK (plano IN ('free', 'plus', 'pro', 'familia'));

-- ============================================================
-- 2. RLS — limitar histórico de transações para plano free
-- (só afeta queries via anon key / usuário autenticado Supabase;
--  queries via service_role ignoram RLS)
-- ============================================================

ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "transacoes_owner_free"   ON transacoes;
DROP POLICY IF EXISTS "transacoes_owner_paid"   ON transacoes;
DROP POLICY IF EXISTS "transacoes_owner_select" ON transacoes;

-- Plano free: acesso aos últimos 30 dias
CREATE POLICY "transacoes_owner_free" ON transacoes
  FOR SELECT
  USING (
    user_id::text = auth.uid()::text
    AND (
      -- usuário tem plano pago OU transação está nos últimos 30 dias
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = auth.uid()::text
          AND u.plano IN ('plus', 'pro', 'familia')
          AND u.plano_ativo = true
      )
      OR data >= (now() - interval '30 days')
    )
  );

-- Escrita: dono pode inserir/atualizar/deletar as próprias transações (qualquer plano)
CREATE POLICY "transacoes_owner_write" ON transacoes
  FOR ALL
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- ============================================================
-- 3. RLS na tabela users — cada utilizador só vê os próprios dados
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_self" ON users;

CREATE POLICY "users_self" ON users
  FOR ALL
  USING (id::text = auth.uid()::text)
  WITH CHECK (id::text = auth.uid()::text);

-- ============================================================
-- 4. RLS na tabela profiles (se existir)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "profiles_self" ON profiles;

    EXECUTE 'CREATE POLICY "profiles_self" ON profiles
      FOR ALL
      USING (id::text = auth.uid()::text)
      WITH CHECK (id::text = auth.uid()::text)';
  END IF;
END $$;
