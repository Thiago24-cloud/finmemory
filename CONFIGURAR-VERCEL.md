# 🔧 Configurar Variáveis de Ambiente na Vercel

## ❗ ERRO ATUAL
```
Erro: supabaseUrl é obrigatório
```

Isso acontece porque as variáveis de ambiente não estão configuradas no projeto da Vercel.

---

## 📋 Variáveis que você PRECISA configurar na Vercel:

### 1. **Supabase** (obrigatório)
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_do_supabase
```

### 2. **Google OAuth** (obrigatório)
```
GOOGLE_CLIENT_ID=seu_client_id_do_google
GOOGLE_CLIENT_SECRET=seu_client_secret_do_google
GOOGLE_REDIRECT_URI=https://finmemory.vercel.app/api/auth/callback
```

### 3. **OpenAI** (obrigatório)
```
OPENAI_API_KEY=sua_chave_da_openai
```

---

## 🚀 PASSO A PASSO para configurar:

### 1. Acesse o Dashboard da Vercel
- Vá para: https://vercel.com/dashboard
- Clique no projeto **finmemory**

### 2. Vá em Settings (Configurações)
- No menu lateral, clique em **"Settings"**

### 3. Clique em "Environment Variables"
- No menu de configurações, clique em **"Environment Variables"**

### 4. Adicione CADA variável
Para cada variável acima:
1. Clique em **"Add New"**
2. Em **"Key"**, cole o nome da variável (ex: `NEXT_PUBLIC_SUPABASE_URL`)
3. Em **"Value"**, cole o valor correspondente
4. Selecione os ambientes: **Production**, **Preview** e **Development**
5. Clique em **"Save"**

### 5. Faça um novo Deploy
- Após adicionar todas as variáveis
- Vá em **"Deployments"**
- Clique em **"Redeploy"** no último deploy
- ✅ Pronto!

---

## 📍 Onde encontrar cada valor:

### **Supabase:**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (cuidado, é secreta!) → `SUPABASE_SERVICE_ROLE_KEY`

### **Google OAuth:**
1. Acesse: https://console.cloud.google.com/
2. Selecione seu projeto
3. Vá em **APIs & Services** > **Credentials**
4. Clique no seu **OAuth 2.0 Client ID**
5. Copie:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`
6. **IMPORTANTE:** Adicione o Redirect URI:
   - Clique em **"Add URI"**
   - Cole: `https://finmemory.vercel.app/api/auth/callback`
   - Salve

### **OpenAI:**
1. Acesse: https://platform.openai.com/api-keys
2. Clique em **"Create new secret key"**
3. Copie a chave → `OPENAI_API_KEY`

---

## ⚠️ IMPORTANTE:

1. **NUNCA** commite essas chaves no código
2. Elas devem ficar APENAS na Vercel (Environment Variables)
3. Após adicionar, faça um **Redeploy**
4. Se ainda der erro, verifique se copiou os valores corretos

---

## ✅ Como testar se funcionou:

Após o redeploy:
1. Acesse: https://finmemory.vercel.app
2. Clique em "Conectar Gmail"
3. Deve redirecionar para o Google (sem erro 500)

Se ainda der erro, verifique os logs no Vercel Dashboard.
