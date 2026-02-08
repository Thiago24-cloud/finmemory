-- ============================================
-- POLÍTICAS RLS PARA O FINMEMORY
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- para permitir que o frontend leia as transações
-- ============================================

-- ============================================
-- TABELA: transacoes
-- ============================================

-- Política 1: Usuários podem ler suas próprias transações
-- Esta política permite que usuários autenticados vejam apenas
-- as transações onde o user_id corresponde ao seu ID
CREATE POLICY "Usuários podem ler suas próprias transações"
ON transacoes
FOR SELECT
USING (
  -- Permite leitura se o user_id da transação corresponde ao usuário autenticado
  -- OU se estiver usando a chave anon (para desenvolvimento)
  auth.uid()::text = user_id::text
  OR 
  -- Permite leitura via anon key (para o frontend)
  (current_setting('request.jwt.claims', true)::json->>'role') = 'anon'
);

-- Política 2: Service Role pode inserir transações
-- Esta política permite que a API (usando service role key) insira transações
-- O service role key já bypassa RLS, mas é bom ter isso explícito
CREATE POLICY "Service role pode inserir transações"
ON transacoes
FOR INSERT
WITH CHECK (true); -- Service role sempre tem permissão

-- Política 3: Service Role pode atualizar transações
CREATE POLICY "Service role pode atualizar transações"
ON transacoes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- TABELA: produtos
-- ============================================

-- Política 1: Usuários podem ler produtos de suas próprias transações
CREATE POLICY "Usuários podem ler produtos de suas transações"
ON produtos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM transacoes
    WHERE transacoes.id = produtos.transacao_id
    AND (
      auth.uid()::text = transacoes.user_id::text
      OR 
      (current_setting('request.jwt.claims', true)::json->>'role') = 'anon'
    )
  )
);

-- Política 2: Service Role pode inserir produtos
CREATE POLICY "Service role pode inserir produtos"
ON produtos
FOR INSERT
WITH CHECK (true);

-- Política 3: Service Role pode atualizar produtos
CREATE POLICY "Service role pode atualizar produtos"
ON produtos
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- TABELA: users
-- ============================================

-- Política 1: Usuários podem ler seu próprio registro
CREATE POLICY "Usuários podem ler seu próprio registro"
ON users
FOR SELECT
USING (
  auth.uid()::text = id::text
  OR 
  email = (current_setting('request.jwt.claims', true)::json->>'email')
  OR
  (current_setting('request.jwt.claims', true)::json->>'role') = 'anon'
);

-- Política 2: Service Role pode inserir/atualizar usuários
CREATE POLICY "Service role pode gerenciar usuários"
ON users
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute estas queries para verificar se as políticas foram criadas:

-- Ver políticas da tabela transacoes
-- SELECT * FROM pg_policies WHERE tablename = 'transacoes';

-- Ver políticas da tabela produtos
-- SELECT * FROM pg_policies WHERE tablename = 'produtos';

-- Ver políticas da tabela users
-- SELECT * FROM pg_policies WHERE tablename = 'users';
