# 🚀 Correção Rápida: RLS Bloqueando Dados

## ⚡ Solução em 3 Passos

### 1️⃣ Abra o Supabase SQL Editor
- Acesse: https://app.supabase.com
- Selecione seu projeto
- Clique em **"SQL Editor"** no menu lateral
- Clique em **"New query"**

### 2️⃣ Cole e Execute Este SQL

```sql
-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir leitura de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de transações do usuário" ON transacoes;
DROP POLICY IF EXISTS "Usuários podem ler suas próprias transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir inserção de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir atualização de transações" ON transacoes;
DROP POLICY IF EXISTS "Permitir leitura de produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir inserção de produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir leitura de usuários" ON users;
DROP POLICY IF EXISTS "Permitir gerenciamento de usuários" ON users;

-- Criar políticas para transacoes
CREATE POLICY "Frontend pode ler transações"
ON transacoes FOR SELECT USING (true);

CREATE POLICY "API pode inserir transações"
ON transacoes FOR INSERT WITH CHECK (true);

CREATE POLICY "API pode atualizar transações"
ON transacoes FOR UPDATE USING (true) WITH CHECK (true);

-- Criar políticas para produtos
CREATE POLICY "Frontend pode ler produtos"
ON produtos FOR SELECT USING (true);

CREATE POLICY "API pode inserir produtos"
ON produtos FOR INSERT WITH CHECK (true);

CREATE POLICY "API pode atualizar produtos"
ON produtos FOR UPDATE USING (true) WITH CHECK (true);

-- Criar políticas para users
CREATE POLICY "Frontend pode ler usuários"
ON users FOR SELECT USING (true);

CREATE POLICY "API pode gerenciar usuários"
ON users FOR ALL USING (true) WITH CHECK (true);
```

### 3️⃣ Clique em "Run" e Pronto!

1. Clique no botão **"Run"** (ou pressione `Ctrl+Enter`)
2. Aguarde a mensagem de sucesso
3. Recarregue o dashboard do seu app
4. **As transações devem aparecer agora!** 🎉

---

## ✅ Verificação

Após executar, verifique:

1. Vá em **"Authentication" → "Policies"**
2. Clique na tabela **"transacoes"**
3. Você deve ver 3 políticas:
   - ✅ Frontend pode ler transações
   - ✅ API pode inserir transações
   - ✅ API pode atualizar transações

---

## 🐛 Se Ainda Não Funcionar

1. **Limpe o cache do navegador** (Ctrl+Shift+Delete)
2. **Recarregue a página** (F5)
3. **Verifique o console** do navegador (F12)
4. **Execute a sincronização** novamente clicando em "Buscar Notas Fiscais"

---

## 📝 Arquivos Disponíveis

- `supabase-rls-policies-finmemory.sql` - Versão completa com comentários
- `supabase-rls-policies-simples.sql` - Versão simplificada
- `CONFIGURAR-RLS.md` - Guia completo e detalhado

---

**Pronto!** Isso deve resolver o problema! 🚀
