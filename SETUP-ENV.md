# FinMemory - Configuração de Variáveis de Ambiente

## 📋 Passo a Passo para Configurar

### 1️⃣ Supabase

1. Acesse https://supabase.com/dashboard
2. Entre no seu projeto **finmemory**
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → use como `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** (chave pública) → use como `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2️⃣ Google OAuth

1. Acesse https://console.cloud.google.com
2. Selecione seu projeto ou crie um novo
3. Vá em **APIs & Services** → **Credentials**
4. Clique em **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/api/auth/callback` (desenvolvimento)
     - `https://finmemory.vercel.app/api/auth/callback` (produção)
6. Copie:
   - **Client ID** → use como `GOOGLE_CLIENT_ID`
   - **Client Secret** → use como `GOOGLE_CLIENT_SECRET`

### 3️⃣ Configurar no Vercel

1. Acesse https://vercel.com
2. Entre no projeto **finmemory**
3. Vá em **Settings** → **Environment Variables**
4. Adicione cada variável:
   - Nome: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: sua URL do Supabase
   - Environments: Production, Preview, Development
   
5. Repita para todas as variáveis do `.env.example`

6. Após adicionar, faça **Redeploy** do projeto:
   - Vá em **Deployments**
   - Clique nos 3 pontinhos do último deploy
   - Clique em **Redeploy**

### 4️⃣ Configurar Localmente (opcional)

1. Copie o arquivo `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

2. Edite `.env.local` com seus valores reais

3. **NUNCA** commite o arquivo `.env.local` no git!

## ⚠️ Importante

- O arquivo `.env.local` já está no `.gitignore`
- As variáveis com prefixo `NEXT_PUBLIC_` são expostas no navegador
- Variáveis sem prefixo são apenas para o servidor
