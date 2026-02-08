# Conectar Google Cloud ao Cursor (para ajudar no código e deploy)

Assim você usa o **Google Cloud (gcloud)** direto no terminal do Cursor para fazer deploy e manter o app.

---

## 1. Instalar o Google Cloud SDK

1. Baixe e instale: **https://cloud.google.com/sdk/docs/install**
2. No Windows: use o instalador ou `winget install Google.CloudSDK`
3. Abra um **novo terminal** (ou reinicie o Cursor) para o `gcloud` estar no PATH

---

## 2. Fazer login e escolher o projeto

No terminal do Cursor (PowerShell ou CMD):

```powershell
# Login (abre o navegador)
gcloud auth login

# Usar o projeto do FinMemory
gcloud config set project finmemory-836908221936

# Conferir
gcloud config list
```

Depois disso, os comandos `gcloud` que você rodar nesse terminal já vão usar o projeto **finmemory-836908221936**.

---

## 3. Deploy manual (build + push + deploy)

Comandos que você citou, **ajustados para o seu projeto e região**:

```powershell
# Na raiz do projeto FinMemory (c:\Users\DELL\Downloads\Finmemory)
cd c:\Users\DELL\Downloads\Finmemory

# Build da imagem
docker build -t gcr.io/finmemory-836908221936/finmemory:latest .

# Configurar Docker para o GCR (só uma vez)
gcloud auth configure-docker gcr.io --quiet

# Push para Google Container Registry
docker push gcr.io/finmemory-836908221936/finmemory:latest

# Deploy no Cloud Run (região southamerica-east1, igual ao seu app)
gcloud run deploy finmemory `
  --image gcr.io/finmemory-836908221936/finmemory:latest `
  --region southamerica-east1 `
  --platform managed `
  --allow-unauthenticated
```

**Ou use o script** (faz tudo em sequência):

```powershell
cd c:\Users\DELL\Downloads\Finmemory
.\scripts\deploy-google-cloud.ps1
```

---

## 4. Resumo: o que ficou igual ao que você queria

| Você queria | Ajuste feito |
|-------------|----------------|
| `SEU_PROJECT_ID` | **finmemory-836908221936** |
| `us-central1` | **southamerica-east1** (região que o seu app já usa) |
| Comandos no Cursor | Script **scripts/deploy-google-cloud.ps1** + comandos acima |

---

## 5. Deploy sem Docker no seu PC (Cloud Build)

Se o `docker` não está instalado ou não funciona no terminal, use o **Cloud Build** (o Google faz o build na nuvem):

```powershell
cd c:\Users\DELL\Downloads\Finmemory
gcloud builds submit --config cloudbuild.yaml --substitutions=COMMIT_SHA=manual
```

Isso envia o código do projeto para o Google, faz o build da imagem lá, o push para o GCR e o deploy no Cloud Run. Demora alguns minutos.

---

## 6. Variáveis de ambiente no Cloud Run

O **build** da imagem não define as variáveis secretas (Supabase, NextAuth, Google, OpenAI). Elas são configuradas **no serviço Cloud Run**:

- **Console:** Cloud Run → finmemory → Editar e implantar nova revisão → **Variáveis e segredos**
- Use o **CHECKLIST-CLOUD-RUN-ENV.md** para conferir se estão iguais às que você tinha quando estava tudo ok.

Assim, com o gcloud instalado e logado no projeto, o Cursor “tem o Google Cloud conectado” para rodar esses comandos e scripts direto no terminal do projeto.
