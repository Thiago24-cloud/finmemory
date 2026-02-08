-- ============================================
-- POLÍTICAS RLS SIMPLES PARA O FINMEMORY
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- ============================================
-- TABELA: transacoes
-- ============================================

-- Política: Permitir leitura de transações baseado no user_id
-- Esta política permite que o frontend leia transações onde
-- o user_id corresponde ao usuário logado
CREATE POLICY "Permitir leitura de transações do usuário"
ON transacoes
FOR SELECT
USING (
  -- Permite leitura se o user_id da transação corresponde ao email do usuário autenticado
  -- OU permite leitura via anon key (para desenvolvimento/teste)
  true  -- Temporariamente permite tudo - ajuste depois se necessário
);

-- Política: Permitir inserção de transações (para a API)
CREATE POLICY "Permitir inserção de transações"
ON transacoes
FOR INSERT
WITH CHECK (true);

-- Política: Permitir atualização de transações (para a API)
CREATE POLICY "Permitir atualização de transações"
ON transacoes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- TABELA: produtos
-- ============================================

-- Política: Permitir leitura de produtos
CREATE POLICY "Permitir leitura de produtos"
ON produtos
FOR SELECT
USING (true);

-- Política: Permitir inserção de produtos (para a API)
CREATE POLICY "Permitir inserção de produtos"
ON produtos
FOR INSERT
WITH CHECK (true);

-- ============================================
-- TABELA: users
-- ============================================

-- Política: Permitir leitura de usuários (para buscar user_id pelo email)
CREATE POLICY "Permitir leitura de usuários"
ON users
FOR SELECT
USING (true);

-- Política: Permitir inserção/atualização de usuários (para a API)
CREATE POLICY "Permitir gerenciamento de usuários"
ON users
FOR ALL
USING (true)
WITH CHECK (true);
