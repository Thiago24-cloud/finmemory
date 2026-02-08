# 🚀 Deploy no Cloud Run - Guia Rápido

## ⚠️ IMPORTANTE: Variáveis de ambiente no Cloud Run

Se você vê nos logs **"Variáveis do Supabase não configuradas no servidor"** ou o alerta **"Você precisa conectar o Gmail primeiro!"** mesmo após login, é porque as **variáveis de ambiente não estão configuradas no serviço Cloud Run** (são definidas em tempo de execução, não no build).

### Variáveis obrigatórias

| Variável | Onde pegar | Uso |
|----------|------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | Cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | Servidor (sessão, sync) |
| `NEXTAUTH_URL` | URL do app | `https://finmemory-836908221936.southamerica-east1.run.app` |
| `NEXTAUTH_SECRET` | Gerar: `openssl rand -base64 32` | Criptografia de sessão |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials | OAuth |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials | OAuth |
| `OPENAI_API_KEY` | platform.openai.com/api-keys | OCR de notas fiscais |

### Como configurar (Console – recomendado)

1. Acesse: **https://console.cloud.google.com/run**
2. Selecione o projeto e a região **southamerica-east1**.
3. Clique no serviço **finmemory**.
4. Aba **"Editar e implantar nova revisão"** (ou "Edit & Deploy New Revision").
5. Aba **"Variáveis e segredos"** / **"Variables & Secrets"**.
6. Em **"Variáveis de ambiente"**, adicione cada par **Nome** / **Valor** (use **"Referência de segredo"** para chaves sensíveis, se quiser).
7. Clique em **"Implantar"**.

### Como configurar (gcloud CLI)

```powershell
gcloud run services update finmemory `
  --region southamerica-east1 `
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...,SUPABASE_SERVICE_ROLE_KEY=eyJ...,NEXTAUTH_URL=https://finmemory-836908221936.southamerica-east1.run.app,NEXTAUTH_SECRET=SUA_CHAVE_32_BYTES,GOOGLE_CLIENT_ID=....apps.googleusercontent.com,GOOGLE_CLIENT_SECRET=GOCSPX-...,OPENAI_API_KEY=sk-..."
```

Para não expor as chaves no terminal, use **Secret Manager** e referencie no Cloud Run (Variáveis e segredos → "Referência de segredo").

Depois de salvar as variáveis, o Cloud Run cria uma nova revisão. O aviso "Variáveis do Supabase não configuradas" e o alerta de "conectar Gmail" devem parar após a próxima requisição à sessão.

---

## Opção 1: Via Google Cloud Console (Mais Fácil - Sem CLI)

### Passo 1: Acesse o Cloud Build
1. Acesse: https://console.cloud.google.com/cloud-build/builds
2. Selecione o projeto: `finmemory-836908221936` (ou seu projeto)

### Passo 2: Criar Build Manual
1. Clique em **"Criar build"** ou **"Trigger build"**
2. Selecione **"Cloud Build configuration file (yaml or json)"**
3. Localização: `cloudbuild.yaml`
4. Clique em **"Executar"**

### Passo 3: Aguardar Build
- O build pode levar 5-10 minutos
- Você verá os logs em tempo real
- Quando terminar, o Cloud Run será atualizado automaticamente

---

## Opção 2: Via gcloud CLI (Mais Rápido)

### Pré-requisitos
1. Instalar Google Cloud SDK: https://cloud.google.com/sdk/docs/install
2. Autenticar: `gcloud auth login`
3. Configurar projeto: `gcloud config set project finmemory-836908221936`

### Executar Deploy
```powershell
# No diretório do projeto
cd c:\Users\DELL\Downloads\Finmemory

# Executar script de deploy
.\deploy-cloud-run.ps1
```

Ou manualmente:
```powershell
# Obter commit SHA
$COMMIT_SHA = git rev-parse --short HEAD
# Se não tiver git, use: $COMMIT_SHA = "manual-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Fazer build e deploy
gcloud builds submit --config cloudbuild.yaml --substitutions=COMMIT_SHA=$COMMIT_SHA
```

---

## Opção 3: Via Docker Local + Push Manual

Se você tem Docker instalado:

```powershell
# 1. Fazer login no GCR
gcloud auth configure-docker

# 2. Build da imagem
docker build -t gcr.io/finmemory-836908221936/finmemory:latest .

# 3. Push da imagem
docker push gcr.io/finmemory-836908221936/finmemory:latest

# 4. Deploy no Cloud Run
gcloud run deploy finmemory `
  --image gcr.io/finmemory-836908221936/finmemory:latest `
  --region southamerica-east1 `
  --platform managed `
  --allow-unauthenticated
```

---

## ✅ Verificar Deploy

Após o deploy, verifique:

1. **URL da aplicação:**
   ```
   https://finmemory-836908221936.southamerica-east1.run.app
   ```

2. **Logs do Cloud Run:**
   - Acesse: https://console.cloud.google.com/run/detail/southamerica-east1/finmemory/logs

3. **Testar sync:**
   - Faça login
   - Clique em "Sincronizar Emails"
   - Verifique os logs para ver se o erro 500 foi corrigido

---

## 🔍 O que foi corrigido nesta versão

- ✅ Tratamento de `last_sync` nulo/inválido
- ✅ Validação de `daysSinceSync` (evita `newer_than:NaNd`)
- ✅ Logs melhorados para debug de erros 500
- ✅ Proteção em `extractEmailBody` contra estruturas de email inválidas

---

## 🆘 Troubleshooting

### Erro: "gcloud não encontrado"
- Instale o Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Ou use a Opção 1 (interface web)

### Erro: "Project not found"
- Verifique o PROJECT_ID no `cloudbuild.yaml`
- Configure: `gcloud config set project SEU_PROJECT_ID`

### Erro: "Permission denied"
- Verifique permissões no IAM: https://console.cloud.google.com/iam-admin/iam
- Você precisa de: Cloud Build Editor, Cloud Run Admin

### Build falha
- Verifique os logs no Cloud Build Console
- Confirme que todas as variáveis de ambiente estão configuradas no Cloud Run

---

## 📝 Notas

- O deploy via Cloud Build é automático (build + push + deploy)
- A imagem é salva no Google Container Registry (GCR)
- O Cloud Run usa a porta 8080 automaticamente
- Variáveis de ambiente devem estar configuradas no Cloud Run (não no build)

---

## 🎯 Próximos Passos

Após o deploy:
1. Teste o sync de emails
2. Verifique os logs se ainda houver erro 500
3. Os novos logs mostrarão exatamente onde está falhando
