-- ============================================
-- COPIE E COLE ESTE SQL NO SUPABASE SQL EDITOR
-- ============================================
-- Instruções:
-- 1. Acesse: https://app.supabase.com
-- 2. Vá em "SQL Editor"
-- 3. Clique em "New query"
-- 4. Cole este código completo
-- 5. Clique em "Run"
-- ============================================

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Permitir leitura de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de transações do usuário" ON transacoes;
DROP POLICY IF EXISTS "Usuários podem ler suas próprias transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir inserção de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir atualização de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários podem ler produtos de suas transações" ON produtos;
DROP POLICY IF EXISTS "Permitir inserção de produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir atualização de produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir leitura de usuários" ON users;
DROP POLICY IF EXISTS "Usuários podem ler seu próprio registro" ON users;
DROP POLICY IF EXISTS "Permitir gerenciamento de usuários" ON users;
DROP POLICY IF EXISTS "Frontend pode ler transações" ON transacoes;
DROP POLICY IF EXISTS "API pode inserir transações" ON transacoes;
DROP POLICY IF EXISTS "API pode atualizar transações" ON transacoes;
DROP POLICY IF EXISTS "Frontend pode ler produtos" ON produtos;
DROP POLICY IF EXISTS "API pode inserir produtos" ON produtos;
DROP POLICY IF EXISTS "API pode atualizar produtos" ON produtos;
DROP POLICY IF EXISTS "Frontend pode ler usuários" ON users;
DROP POLICY IF EXISTS "API pode gerenciar usuários" ON users;

-- ============================================
-- CRIAR POLÍTICAS PARA A TABELA: transacoes
-- ============================================

CREATE POLICY "Frontend pode ler transações"
ON transacoes
FOR SELECT
USING (true);

CREATE POLICY "API pode inserir transações"
ON transacoes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "API pode atualizar transações"
ON transacoes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- CRIAR POLÍTICAS PARA A TABELA: produtos
-- ============================================

CREATE POLICY "Frontend pode ler produtos"
ON produtos
FOR SELECT
USING (true);

CREATE POLICY "API pode inserir produtos"
ON produtos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "API pode atualizar produtos"
ON produtos
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- CRIAR POLÍTICAS PARA A TABELA: users
-- ============================================

CREATE POLICY "Frontend pode ler usuários"
ON users
FOR SELECT
USING (true);

CREATE POLICY "API pode gerenciar usuários"
ON users
FOR ALL
USING (true)
WITH CHECK (true);
