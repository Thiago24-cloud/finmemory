# 🔧 Guia Completo de Configuração Vercel - FinMemory

## 📌 Visão Geral

Este guia detalha o processo completo de configuração das variáveis de ambiente na Vercel para o projeto FinMemory funcionar corretamente.

## ❗ Problemas Comuns

Se você está vendo erros como:
- ❌ `Erro: supabaseUrl é obrigatório`
- ❌ `Variáveis do Google OAuth não configuradas`
- ❌ `OPENAI_API_KEY não configurada`

**Causa:** As variáveis de ambiente não foram configuradas na Vercel.

---

## 📋 Variáveis Obrigatórias

### 1. **Supabase** (Banco de Dados) ⚠️ OBRIGATÓRIO
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Por que:** Armazena usuários, transações e produtos extraídos dos emails.

### 2. **Google OAuth** (Autenticação Gmail) ⚠️ OBRIGATÓRIO
```env
GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://finmemory.vercel.app/api/auth/callback/google
```
**Por que:** Permite login com Google e acesso aos emails do Gmail.

### 3. **OpenAI** (Inteligência Artificial) ⚠️ OBRIGATÓRIO
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```
**Por que:** Processa e extrai informações das notas fiscais usando IA.

---

## 🚀 Passo a Passo Detalhado

### Etapa 1: Acessar o Projeto na Vercel
1. Acesse: **https://vercel.com/dashboard**
2. Faça login com sua conta
3. Localize e clique no projeto **finmemory**

### Etapa 2: Acessar Configurações
1. No projeto, clique em **"Settings"** no menu superior
2. No menu lateral, clique em **"Environment Variables"**

### Etapa 3: Adicionar Cada Variável
Para **CADA UMA** das variáveis listadas acima:

1. Clique no botão **"Add New"** ou **"Add Another"**
2. Em **"Key"** (Nome):
   - Cole o nome EXATO da variável
   - Exemplo: `NEXT_PUBLIC_SUPABASE_URL`
3. Em **"Value"** (Valor):
   - Cole o valor correspondente (veja seção abaixo)
4. Em **"Environment"** (Ambientes):
   - ✅ Marque: **Production**
   - ✅ Marque: **Preview**
   - ✅ Marque: **Development**
5. Clique em **"Save"**

### Etapa 4: Fazer Redeploy
**IMPORTANTE:** Após adicionar TODAS as variáveis:

1. Vá na aba **"Deployments"**
2. Localize o deploy mais recente
3. Clique nos **3 pontinhos** (•••) ao lado
4. Clique em **"Redeploy"**
5. Confirme clicando em **"Redeploy"** novamente
6. Aguarde o deploy completar (1-3 minutos)
7. ✅ Teste seu site!

---

## 📍 Onde Encontrar os Valores

### 🗄️ Supabase (Banco de Dados)

1. Acesse: **https://supabase.com/dashboard**
2. Selecione seu projeto **finmemory**
3. Clique em **Settings** (⚙️) no menu lateral
4. Clique em **API**
5. Copie os valores:

| Variável | Onde encontrar | Cuidado |
|----------|----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** | ✅ Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon public** (clique em "Reveal") | ✅ Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (clique em "Reveal") | ⚠️ SECRETA - Nunca exponha! |

### 🔐 Google OAuth (Login Gmail)

1. Acesse: **https://console.cloud.google.com/**
2. Selecione seu projeto ou crie um novo
3. No menu lateral: **APIs & Services** → **Credentials**
4. Localize ou crie um **OAuth 2.0 Client ID**
5. Copie os valores:

| Variável | Onde encontrar |
|----------|----------------|
| `GOOGLE_CLIENT_ID` | **Client ID** |
| `GOOGLE_CLIENT_SECRET` | **Client secret** |

6. **IMPORTANTE - Configure o Redirect URI:**
   - Na mesma tela, em **"Authorized redirect URIs"**
   - Clique em **"+ ADD URI"**
   - Adicione: `https://finmemory.vercel.app/api/auth/callback/google`
   - Clique em **"SAVE"**

7. **Configure a OAuth Consent Screen:**
   - Vá em **OAuth consent screen**
   - Configure tipo **External**
   - Adicione os escopos:
     - `userinfo.email`
     - `userinfo.profile`
     - `gmail.readonly`

### 🤖 OpenAI (Inteligência Artificial)

1. Acesse: **https://platform.openai.com/api-keys**
2. Faça login na sua conta OpenAI
3. Clique em **"+ Create new secret key"**
4. Dê um nome: `FinMemory`
5. Copie a chave **IMEDIATAMENTE** (ela só aparece uma vez!)
6. Cole em `OPENAI_API_KEY`

⚠️ **Importante:** 
- Se perder a chave, terá que criar uma nova
- A OpenAI é paga (mas oferece créditos iniciais grátis)
- Monitore o uso em: https://platform.openai.com/usage

---

## ✅ Checklist de Verificação

Antes de fazer o deploy, confirme:

- [ ] **Supabase**
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
  - [ ] Tabelas `users`, `transacoes` e `produtos` criadas

- [ ] **Google OAuth**
  - [ ] `GOOGLE_CLIENT_ID` configurada
  - [ ] `GOOGLE_CLIENT_SECRET` configurada
  - [ ] `GOOGLE_REDIRECT_URI` = `https://finmemory.vercel.app/api/auth/callback/google`
  - [ ] Redirect URI adicionado no Google Console
  - [ ] OAuth Consent Screen configurada
  - [ ] Escopos Gmail adicionados

- [ ] **OpenAI**
  - [ ] `OPENAI_API_KEY` configurada
  - [ ] Créditos disponíveis na conta

- [ ] **Vercel**
  - [ ] Todas as variáveis adicionadas
  - [ ] Ambientes (Production, Preview, Development) marcados
  - [ ] Redeploy realizado
  - [ ] Deploy completou sem erros

---

## 🔧 Troubleshooting (Resolução de Problemas)

### Problema: "supabaseUrl é obrigatório"
**Causa:** Variáveis do Supabase não configuradas na Vercel

**Solução:**
1. Verifique se `NEXT_PUBLIC_SUPABASE_URL` está configurada
2. Verifique se a URL está correta (formato: `https://xxxxx.supabase.co`)
3. Faça redeploy após adicionar

### Problema: "Variáveis do Google OAuth não configuradas"
**Causa:** Credenciais do Google não configuradas ou incorretas

**Solução:**
1. Verifique todas as 3 variáveis do Google
2. Confirme que o Redirect URI está correto na Vercel
3. Confirme que o Redirect URI foi adicionado no Google Console
4. Formato correto: `https://finmemory.vercel.app/api/auth/callback/google`

### Problema: "OPENAI_API_KEY não configurada"
**Causa:** Chave da OpenAI não foi adicionada

**Solução:**
1. Crie uma chave em: https://platform.openai.com/api-keys
2. Adicione na Vercel
3. Verifique se copiou a chave completa (começa com `sk-`)

### Problema: "Token expired" ou "Invalid token"
**Causa:** Token do Google expirou ou é inválido

**Solução:**
1. Faça logout e login novamente
2. Se persistir, revogue o acesso em: https://myaccount.google.com/permissions
3. Tente conectar novamente

### Problema: Deploy falha com erro 500
**Causa:** Alguma variável está faltando ou incorreta

**Solução:**
1. Verifique os logs do deploy na Vercel
2. Confira se TODAS as 7 variáveis estão configuradas
3. Verifique se não há espaços extras nos valores
4. Tente fazer um redeploy limpo

### Problema: "Cannot read properties of undefined"
**Causa:** Código tentando acessar variável não configurada

**Solução:**
1. Verifique os logs para identificar qual variável
2. Configure a variável faltante
3. Redeploy

---

## 🔒 Segurança - Boas Práticas

### ⚠️ NUNCA faça isso:
- ❌ Commitar arquivos `.env` ou `.env.local` no Git
- ❌ Expor `SUPABASE_SERVICE_ROLE_KEY` no código cliente
- ❌ Compartilhar `GOOGLE_CLIENT_SECRET` publicamente
- ❌ Compartilhar `OPENAI_API_KEY` em repositórios públicos
- ❌ Usar as mesmas credenciais em múltiplos projetos

### ✅ Sempre faça isso:
- ✅ Mantenha `.env.local` no `.gitignore`
- ✅ Use diferentes credenciais para dev/prod
- ✅ Rotacione chaves periodicamente (a cada 90 dias)
- ✅ Monitore uso da API OpenAI
- ✅ Configure rate limiting na Supabase
- ✅ Revise logs regularmente para detectar abusos

---

## 📊 Monitoramento

### Vercel Analytics
- Veja métricas de uso em: https://vercel.com/[seu-projeto]/analytics
- Monitore erros em tempo real

### Supabase Dashboard
- Veja uso do banco em: https://supabase.com/dashboard
- Monitore queries lentas
- Verifique tamanho do banco

### OpenAI Usage
- Monitore custos em: https://platform.openai.com/usage
- Configure alertas de limite de gasto
- Média esperada: ~$0.01-0.05 por nota fiscal processada

---

## 📞 Precisa de Ajuda?

Se após seguir todos os passos ainda houver problemas:

1. **Verifique os logs da Vercel:**
   - Vá em **Deployments** → Clique no deploy → **View Function Logs**

2. **Teste localmente primeiro:**
   ```bash
   npm run dev
   ```
   - Se funcionar local mas não na Vercel, é problema de env vars

3. **Recursos Úteis:**
   - Documentação Vercel: https://vercel.com/docs/environment-variables
   - Documentação Supabase: https://supabase.com/docs
   - Documentação Google OAuth: https://developers.google.com/identity/protocols/oauth2
   - Documentação OpenAI: https://platform.openai.com/docs

---

## 🎉 Depois de Configurar

Com tudo configurado, seu app deve:
- ✅ Carregar sem erros
- ✅ Permitir login com Google
- ✅ Sincronizar emails do Gmail
- ✅ Processar notas fiscais com IA
- ✅ Salvar transações no banco

**Próximos passos:**
1. Teste o login com Google
2. Sincronize seus emails
3. Verifique se as transações aparecem no dashboard
4. Configure alertas de gastos (opcional)
---

## ✅ Como testar se funcionou:

Após o redeploy:
1. Acesse: https://finmemory.vercel.app
2. Clique em "Conectar Gmail"
3. Deve redirecionar para o Google (sem erro 500)

Se ainda der erro, verifique os logs no Vercel Dashboard.
