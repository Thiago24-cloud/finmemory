# 🔐 Como Configurar RLS (Row Level Security) no Supabase

## 🎯 Problema Identificado

O Supabase está bloqueando todas as consultas porque:
- ✅ RLS está **ATIVADO** na tabela `transacoes`
- ❌ Mas **NÃO EXISTEM políticas** criadas
- 🔒 Resultado: Nenhum dado é retornado, mesmo que existam transações no banco

## ✅ Solução: Criar Políticas RLS

### Passo 1: Acessar o SQL Editor no Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral, clique em **"SQL Editor"** (ou "Editor SQL")
4. Clique em **"New query"** (Nova consulta)

### Passo 2: Executar as Políticas

**Opção 1: SQL Simples (Recomendado para começar)**

Copie e cole o seguinte SQL no editor (do arquivo `supabase-rls-policies-finmemory.sql`):

```sql
-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Permitir leitura de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de transações do usuário" ON transacoes;
DROP POLICY IF EXISTS "Usuários podem ler suas próprias transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir inserção de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir atualização de transações" ON transacoes;

DROP POLICY IF EXISTS "Permitir leitura de produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir inserção de produtos" ON produtos;

DROP POLICY IF EXISTS "Permitir leitura de usuários" ON users;
DROP POLICY IF EXISTS "Permitir gerenciamento de usuários" ON users;

-- TABELA: transacoes
CREATE POLICY "Frontend pode ler transações"
ON transacoes FOR SELECT USING (true);

CREATE POLICY "API pode inserir transações"
ON transacoes FOR INSERT WITH CHECK (true);

CREATE POLICY "API pode atualizar transações"
ON transacoes FOR UPDATE USING (true) WITH CHECK (true);

-- TABELA: produtos
CREATE POLICY "Frontend pode ler produtos"
ON produtos FOR SELECT USING (true);

CREATE POLICY "API pode inserir produtos"
ON produtos FOR INSERT WITH CHECK (true);

CREATE POLICY "API pode atualizar produtos"
ON produtos FOR UPDATE USING (true) WITH CHECK (true);

-- TABELA: users
CREATE POLICY "Frontend pode ler usuários"
ON users FOR SELECT USING (true);

CREATE POLICY "API pode gerenciar usuários"
ON users FOR ALL USING (true) WITH CHECK (true);
```

**OU use o arquivo completo:** Abra o arquivo `supabase-rls-policies-finmemory.sql` e copie todo o conteúdo.

### Passo 2 (Alternativo): SQL do arquivo

```sql
-- ============================================
-- POLÍTICAS RLS PARA O FINMEMORY
-- ============================================

-- TABELA: transacoes
-- Permitir leitura de transações
CREATE POLICY "Permitir leitura de transações"
ON transacoes
FOR SELECT
USING (true);

-- Permitir inserção de transações (para a API)
CREATE POLICY "Permitir inserção de transações"
ON transacoes
FOR INSERT
WITH CHECK (true);

-- Permitir atualização de transações (para a API)
CREATE POLICY "Permitir atualização de transações"
ON transacoes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- TABELA: produtos
-- Permitir leitura de produtos
CREATE POLICY "Permitir leitura de produtos"
ON produtos
FOR SELECT
USING (true);

-- Permitir inserção de produtos (para a API)
CREATE POLICY "Permitir inserção de produtos"
ON produtos
FOR INSERT
WITH CHECK (true);

-- TABELA: users
-- Permitir leitura de usuários
CREATE POLICY "Permitir leitura de usuários"
ON users
FOR SELECT
USING (true);

-- Permitir inserção/atualização de usuários (para a API)
CREATE POLICY "Permitir gerenciamento de usuários"
ON users
FOR ALL
USING (true)
WITH CHECK (true);
```

### Passo 3: Executar o SQL

1. Clique no botão **"Run"** (Executar) ou pressione `Ctrl+Enter`
2. Aguarde a confirmação de sucesso
3. Você deve ver mensagens como: "Success. No rows returned"

### Passo 4: Verificar se Funcionou

1. Volte para **"Authentication" → "Policies"** no menu lateral
2. Clique na tabela **"transacoes"**
3. Você deve ver as 3 políticas criadas:
   - ✅ Permitir leitura de transações
   - ✅ Permitir inserção de transações
   - ✅ Permitir atualização de transações

### Passo 5: Testar no App

1. Recarregue a página do dashboard
2. As transações devem aparecer agora! 🎉

## 🔒 Segurança (Opcional - Mais Avançado)

As políticas acima são **permissivas** (permitem tudo). Para produção, você pode criar políticas mais restritivas:

### Política Restritiva para Transações (Opcional)

```sql
-- Remove a política permissiva
DROP POLICY IF EXISTS "Permitir leitura de transações" ON transacoes;

-- Cria política restritiva: usuários só veem suas próprias transações
CREATE POLICY "Usuários veem apenas suas transações"
ON transacoes
FOR SELECT
USING (
  -- Permite se o user_id corresponde ao email do usuário logado
  user_id IN (
    SELECT id FROM users 
    WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
  )
  OR
  -- Permite leitura via anon key (para desenvolvimento)
  (current_setting('request.jwt.claims', true)::json->>'role') = 'anon'
);
```

**Nota:** A política restritiva é mais segura, mas requer que o frontend passe o email do usuário no token JWT. Para começar, use a política permissiva e ajuste depois.

## 🐛 Troubleshooting

### Erro: "policy already exists"
- **Solução:** Execute primeiro: `DROP POLICY IF EXISTS "Nome da Política" ON nome_tabela;`

### Erro: "permission denied"
- **Solução:** Certifique-se de estar usando a conta de administrador do projeto

### Políticas criadas mas ainda não funciona
1. Verifique se RLS está ativado: deve mostrar "Desativar RLS" (não "Ativar RLS")
2. Verifique se as políticas aparecem na lista
3. Limpe o cache do navegador e recarregue
4. Verifique os logs do console do navegador

## 📚 Recursos

- [Documentação RLS do Supabase](https://supabase.com/docs/guides/auth/row-level-security)
- [Guia de Políticas RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## ✅ Checklist

- [ ] Acessei o SQL Editor no Supabase
- [ ] Executei o SQL das políticas
- [ ] Verifiquei que as políticas foram criadas
- [ ] Recarreguei o dashboard
- [ ] As transações aparecem corretamente

---

**Pronto!** Após executar essas políticas, seu app deve funcionar perfeitamente! 🚀
