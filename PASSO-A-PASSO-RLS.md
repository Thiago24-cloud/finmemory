# 🎯 Guia Passo a Passo: Configurar RLS no Supabase

## 📋 Pré-requisitos
- ✅ Conta no Supabase
- ✅ Projeto criado no Supabase
- ✅ Acesso ao dashboard do projeto

---

## 🚀 PASSO 1: Acessar o Supabase Dashboard

1. **Abra seu navegador** (Chrome, Firefox, Edge, etc.)

2. **Acesse:** https://app.supabase.com

3. **Faça login** com sua conta do Supabase

4. **Selecione seu projeto** na lista de projetos
   - Procure pelo nome do seu projeto (provavelmente algo como "FinMemory" ou similar)

---

## 🔍 PASSO 2: Localizar o SQL Editor

1. **No menu lateral esquerdo**, procure por:
   - **"SQL Editor"** (Editor SQL)
   - Ou o ícone de **</>** (código)

2. **Clique em "SQL Editor"**

3. Você verá uma tela com:
   - Um editor de código no centro
   - Botões "New query" ou "Nova consulta" no topo

---

## 📝 PASSO 3: Criar Nova Query

1. **Clique no botão "New query"** (ou "Nova consulta")
   - Geralmente fica no canto superior direito ou esquerdo

2. **Uma nova aba/editor** será aberta

3. **O editor estará vazio** e pronto para você colar o SQL

---

## 📋 PASSO 4: Copiar o SQL

**Opção A: Do arquivo (Recomendado)**

1. **Abra o arquivo:** `supabase-rls-policies-finmemory.sql`
   - Está na pasta do seu projeto
   - Você pode abrir no VS Code, Notepad, ou qualquer editor de texto

2. **Selecione TODO o conteúdo** (Ctrl+A)

3. **Copie** (Ctrl+C)

**Opção B: Do guia rápido**

1. **Abra o arquivo:** `QUICK-FIX-RLS.md`

2. **Localize a seção "### 2️⃣ Cole e Execute Este SQL"**

3. **Copie todo o código SQL** que está entre os ```sql e ```

---

## 📥 PASSO 5: Colar no Editor SQL

1. **Clique dentro do editor SQL** do Supabase

2. **Cole o código** (Ctrl+V)

3. **Você deve ver algo assim:**

```sql
-- ============================================
-- POLÍTICAS RLS ESPECÍFICAS PARA FINMEMORY
-- ============================================
...
```

---

## ▶️ PASSO 6: Executar o SQL

1. **Localize o botão "Run"** (Executar)
   - Geralmente fica no canto superior direito do editor
   - Ou pode ser um botão verde com ícone de play ▶️

2. **Clique em "Run"**
   - Ou pressione **Ctrl+Enter** (atalho)

3. **Aguarde alguns segundos**

4. **Você verá uma mensagem de sucesso:**
   - ✅ "Success. No rows returned"
   - ✅ Ou "Query executed successfully"
   - ✅ Ou mensagens de sucesso para cada política criada

---

## ✅ PASSO 7: Verificar se Funcionou

### Verificação Visual:

1. **No menu lateral**, clique em **"Authentication"** (Autenticação)

2. **Clique em "Policies"** (Políticas)

3. **Você verá uma lista de tabelas:**
   - `transacoes`
   - `produtos`
   - `users`

4. **Clique na tabela `transacoes`**

5. **Você deve ver 3 políticas criadas:**
   - ✅ "Frontend pode ler transações"
   - ✅ "API pode inserir transações"
   - ✅ "API pode atualizar transações"

6. **Repita para as outras tabelas:**
   - Clique em `produtos` - deve ter 3 políticas
   - Clique em `users` - deve ter 2 políticas

---

## 🧪 PASSO 8: Testar no App

1. **Volte para o seu app** (dashboard)

2. **Recarregue a página** (F5 ou Ctrl+R)

3. **Aguarde o carregamento**

4. **As transações devem aparecer agora!** 🎉

---

## 🐛 Se Algo Der Errado

### Erro: "policy already exists"

**Solução:**
1. O SQL já tem comandos `DROP POLICY IF EXISTS` que removem políticas antigas
2. Se ainda der erro, execute primeiro:
```sql
DROP POLICY IF EXISTS "Nome da Política" ON nome_tabela;
```

### Erro: "permission denied"

**Solução:**
1. Certifique-se de estar logado como **administrador** do projeto
2. Verifique se você tem permissões de administrador

### Políticas criadas mas ainda não funciona

1. **Limpe o cache do navegador:**
   - Pressione `Ctrl+Shift+Delete`
   - Selecione "Cache" ou "Imagens e arquivos em cache"
   - Clique em "Limpar dados"

2. **Recarregue a página** (F5)

3. **Abra o console do navegador** (F12)
   - Vá na aba "Console"
   - Veja se há erros

4. **Execute a sincronização novamente:**
   - Clique em "🔄 Buscar Notas Fiscais"
   - Aguarde o processamento

---

## 📸 Screenshots de Referência

### Como deve ficar o SQL Editor:
```
┌─────────────────────────────────────┐
│  SQL Editor              [New query]│
├─────────────────────────────────────┤
│                                     │
│  -- POLÍTICAS RLS...                │
│  DROP POLICY IF EXISTS...           │
│  CREATE POLICY...                   │
│  ...                                │
│                                     │
└─────────────────────────────────────┘
         [Run] [Save] [Format]
```

### Como deve ficar após executar:
```
✅ Success. No rows returned
✅ Policy "Frontend pode ler transações" created
✅ Policy "API pode inserir transações" created
...
```

---

## ✅ Checklist Final

Marque cada item conforme completa:

- [ ] Acessei o Supabase Dashboard
- [ ] Encontrei o SQL Editor
- [ ] Criei uma nova query
- [ ] Copiei o SQL do arquivo
- [ ] Colei no editor
- [ ] Executei o SQL (Run)
- [ ] Vi mensagem de sucesso
- [ ] Verifiquei as políticas em "Authentication → Policies"
- [ ] Recarreguei o dashboard do app
- [ ] As transações aparecem! 🎉

---

## 🆘 Precisa de Ajuda?

Se algo não funcionar:

1. **Tire um print** da tela do erro
2. **Copie a mensagem de erro** completa
3. **Verifique o console** do navegador (F12)
4. **Me envie essas informações** e eu te ajudo!

---

**Boa sorte! Você consegue! 🚀**
