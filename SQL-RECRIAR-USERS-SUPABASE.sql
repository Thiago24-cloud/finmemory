-- ============================================
-- FINMEMORY - RECRIAR/REPARAR TABELA USERS E POLÍTICAS
-- ============================================
-- Execute no Supabase: SQL Editor → New query → Cole e Execute
-- 
-- Use este script se você deletou dados ou estrutura da tabela users.
-- Depois de executar, faça LOGIN novamente no app (ou conecte o Gmail no dashboard)
-- para que seu usuário seja gravado de novo na tabela users.
-- ============================================

-- ============================================
-- 1. GARANTIR TABELA users COM TODAS AS COLUNAS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  google_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas caso a tabela exista mas falte alguma
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Unique em email (obrigatório para o NextAuth fazer upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'users' AND c.conname LIKE '%email%'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- 2. ATIVAR RLS
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. REMOVER E CRIAR POLÍTICAS
-- ============================================

DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_insert_all" ON users;
DROP POLICY IF EXISTS "users_update_all" ON users;
DROP POLICY IF EXISTS "Frontend pode ler usuários" ON users;
DROP POLICY IF EXISTS "API pode gerenciar usuários" ON users;
DROP POLICY IF EXISTS "Permitir leitura de usuários" ON users;
DROP POLICY IF EXISTS "Permitir gerenciamento de usuários" ON users;

CREATE POLICY "users_select_all"
ON users FOR SELECT USING (true);

CREATE POLICY "users_insert_all"
ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_all"
ON users FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- 4. VERIFICAR
-- ============================================
SELECT 'users' as tabela, count(*) as qtd_colunas 
FROM information_schema.columns WHERE table_name = 'users';
