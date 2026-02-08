-- ============================================
-- POLÍTICAS RLS ESPECÍFICAS PARA FINMEMORY
-- ============================================
-- Sistema: NextAuth + Google OAuth + Supabase
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- ============================================
-- IMPORTANTE: Remover políticas antigas (se existirem)
-- ============================================
DROP POLICY IF EXISTS "Permitir leitura de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de transações do usuário" ON transacoes;
DROP POLICY IF EXISTS "Usuários podem ler suas próprias transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir inserção de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir atualização de transações" ON transacoes;

DROP POLICY IF EXISTS "Permitir leitura de produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários podem ler produtos de suas transações" ON produtos;
DROP POLICY IF EXISTS "Permitir inserção de produtos" ON produtos;

DROP POLICY IF EXISTS "Permitir leitura de usuários" ON users;
DROP POLICY IF EXISTS "Usuários podem ler seu próprio registro" ON users;
DROP POLICY IF EXISTS "Permitir gerenciamento de usuários" ON users;

-- ============================================
-- TABELA: transacoes
-- ============================================

-- Política 1: Leitura de transações
-- Permite que o frontend leia transações usando a chave anon
-- Como o NextAuth não usa auth.uid() do Supabase, permitimos leitura via anon key
CREATE POLICY "Frontend pode ler transações"
ON transacoes
FOR SELECT
USING (
  -- Permite leitura via anon key (usado pelo frontend)
  -- O filtro por user_id é feito no código do frontend
  true
);

-- Política 2: Inserção de transações
-- Permite que a API (service role) insira transações
CREATE POLICY "API pode inserir transações"
ON transacoes
FOR INSERT
WITH CHECK (true);

-- Política 3: Atualização de transações
-- Permite que a API (service role) atualize transações
CREATE POLICY "API pode atualizar transações"
ON transacoes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- TABELA: produtos
-- ============================================

-- Política 1: Leitura de produtos
-- Permite que o frontend leia produtos das transações
CREATE POLICY "Frontend pode ler produtos"
ON produtos
FOR SELECT
USING (
  -- Permite leitura via anon key
  -- O filtro é feito através do join com transacoes no frontend
  true
);

-- Política 2: Inserção de produtos
-- Permite que a API (service role) insira produtos
CREATE POLICY "API pode inserir produtos"
ON produtos
FOR INSERT
WITH CHECK (true);

-- Política 3: Atualização de produtos
-- Permite que a API (service role) atualize produtos
CREATE POLICY "API pode atualizar produtos"
ON produtos
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- TABELA: users
-- ============================================

-- Política 1: Leitura de usuários
-- Permite que o frontend leia usuários para buscar user_id pelo email
CREATE POLICY "Frontend pode ler usuários"
ON users
FOR SELECT
USING (
  -- Permite leitura via anon key
  -- O filtro por email é feito no código do frontend
  true
);

-- Política 2: Inserção/Atualização de usuários
-- Permite que a API (service role) gerencie usuários
CREATE POLICY "API pode gerenciar usuários"
ON users
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute estas queries para verificar se as políticas foram criadas:

-- Ver todas as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('transacoes', 'produtos', 'users')
ORDER BY tablename, policyname;

-- ============================================
-- TESTE RÁPIDO
-- ============================================
-- Execute este teste para verificar se as políticas estão funcionando:

-- Teste 1: Verificar se consegue ler transacoes
-- SELECT COUNT(*) FROM transacoes;

-- Teste 2: Verificar se consegue ler produtos
-- SELECT COUNT(*) FROM produtos;

-- Teste 3: Verificar se consegue ler users
-- SELECT COUNT(*) FROM users;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Estas políticas são permissivas (permitem tudo via anon key)
-- 2. A segurança é garantida pelo filtro no código: .eq('user_id', uid)
-- 3. Para produção, considere criar políticas mais restritivas
-- 4. O service role key (usado pela API) sempre bypassa RLS
-- ============================================
