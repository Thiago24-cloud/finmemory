-- ============================================
-- FINMEMORY - TABELAS E POLÍTICAS RLS COMPLETAS
-- ============================================
-- Execute no Supabase: SQL Editor → New query → Cole e Execute
-- ============================================

-- ============================================
-- 1. TABELA users
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

-- Unique em email (para upsert do NextAuth) - só se não existir
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
-- 2. TABELA transacoes
-- ============================================
CREATE TABLE IF NOT EXISTS transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estabelecimento TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  data DATE,
  hora TEXT,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  descontos DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2),
  numero_nota TEXT,
  chave_acesso TEXT,
  email_id TEXT,
  source TEXT DEFAULT 'email',
  receipt_image_url TEXT,
  items JSONB,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas que podem não existir (se tabela já existe)
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'email';
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS categoria TEXT;

-- FK user_id (ignora se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transacoes_user_id_fkey' AND table_name = 'transacoes'
  ) THEN
    ALTER TABLE transacoes ADD CONSTRAINT transacoes_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON transacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data DESC);

-- ============================================
-- 3. TABELA produtos
-- ============================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL REFERENCES transacoes(id) ON DELETE CASCADE,
  codigo TEXT,
  descricao TEXT,
  quantidade DECIMAL(10,2) DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0
);

-- Índice para join
CREATE INDEX IF NOT EXISTS idx_produtos_transacao_id ON produtos(transacao_id);

-- ============================================
-- 4. ATIVAR RLS EM TODAS AS TABELAS
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. REMOVER POLÍTICAS ANTIGAS (todas as versões)
-- ============================================
-- users
DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_insert_all" ON users;
DROP POLICY IF EXISTS "users_update_all" ON users;
DROP POLICY IF EXISTS "Frontend pode ler usuários" ON users;
DROP POLICY IF EXISTS "API pode gerenciar usuários" ON users;
DROP POLICY IF EXISTS "Permitir leitura de usuários" ON users;
DROP POLICY IF EXISTS "Permitir gerenciamento de usuários" ON users;

-- transacoes
DROP POLICY IF EXISTS "transacoes_select_all" ON transacoes;
DROP POLICY IF EXISTS "transacoes_insert_all" ON transacoes;
DROP POLICY IF EXISTS "transacoes_update_all" ON transacoes;
DROP POLICY IF EXISTS "Frontend pode ler transações" ON transacoes;
DROP POLICY IF EXISTS "API pode inserir transações" ON transacoes;
DROP POLICY IF EXISTS "API pode atualizar transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir inserção de transações" ON transacoes;

-- produtos
DROP POLICY IF EXISTS "produtos_select_all" ON produtos;
DROP POLICY IF EXISTS "produtos_insert_all" ON produtos;
DROP POLICY IF EXISTS "Frontend pode ler produtos" ON produtos;
DROP POLICY IF EXISTS "API pode inserir produtos" ON produtos;
DROP POLICY IF EXISTS "API pode atualizar produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir leitura de produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir inserção de produtos" ON produtos;

-- ============================================
-- 6. CRIAR POLÍTICAS RLS
-- ============================================

-- --- TABELA users ---
-- Frontend (anon key) precisa ler users para buscar user_id pelo email
CREATE POLICY "users_select_all"
ON users FOR SELECT
USING (true);

-- API (service_role) precisa inserir/atualizar no signIn do NextAuth
CREATE POLICY "users_insert_all"
ON users FOR INSERT
WITH CHECK (true);

CREATE POLICY "users_update_all"
ON users FOR UPDATE
USING (true)
WITH CHECK (true);

-- --- TABELA transacoes ---
-- Frontend lê transações (filtro por user_id é no código)
CREATE POLICY "transacoes_select_all"
ON transacoes FOR SELECT
USING (true);

-- API insere transações (Gmail sync + OCR)
CREATE POLICY "transacoes_insert_all"
ON transacoes FOR INSERT
WITH CHECK (true);

-- API atualiza se necessário
CREATE POLICY "transacoes_update_all"
ON transacoes FOR UPDATE
USING (true)
WITH CHECK (true);

-- --- TABELA produtos ---
-- Frontend lê produtos (via join com transacoes)
CREATE POLICY "produtos_select_all"
ON produtos FOR SELECT
USING (true);

-- API insere produtos (Gmail sync + OCR)
CREATE POLICY "produtos_insert_all"
ON produtos FOR INSERT
WITH CHECK (true);

-- ============================================
-- 7. BUCKET receipts (para OCR)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket
DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access receipts" ON storage.objects;

CREATE POLICY "Service role full access receipts"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================
-- 8. VERIFICAR
-- ============================================
SELECT 'users' as tabela, count(*) as colunas 
FROM information_schema.columns WHERE table_name = 'users'
UNION ALL
SELECT 'transacoes', count(*) 
FROM information_schema.columns WHERE table_name = 'transacoes'
UNION ALL
SELECT 'produtos', count(*) 
FROM information_schema.columns WHERE table_name = 'produtos';

-- Listar políticas criadas
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'transacoes', 'produtos')
ORDER BY tablename, policyname;
