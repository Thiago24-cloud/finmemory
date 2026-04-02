# Deploy no Google Cloud Run (do zero)

O FinMemory usa **Docker** + **Next.js standalone** (`Dockerfile` na raiz) e **`cloudbuild.yaml`** para construir a imagem e publicar o serviço **`finmemory`** na região **`southamerica-east1`**.

> **Não usar Vercel** para este projeto: produção = Cloud Run.

**Projeto GCP de produção:** `exalted-entry-480904-s9`. O comando `npm run deploy:cloud-run` usa este projeto por defeito (`scripts/deploy-cloud-run.mjs`). O projeto **`finmemory-667c3` não deve ser usado**.

**Checklist pós-configuração (OAuth, variáveis, testes):** [CHECKLIST-DEPLOY.md](../CHECKLIST-DEPLOY.md) (na raiz do repositório).

---

## 1. Pré-requisitos

- Conta Google Cloud com faturamento ativo (ou créditos).
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) instalado e logado:
  ```bash
  gcloud auth login
  gcloud auth application-default login
  ```
- Repositório clonado e dependências locais opcionais (o build pesado roda no Cloud Build).

---

## 2. Projeto e APIs (uma vez por projeto)

```bash
# Substituir pelo seu Project ID (Console → IAM → projeto)
gcloud config set project SEU_PROJECT_ID

gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

---

## 3. Permissões do Cloud Build

A conta de serviço do Cloud Build precisa empurrar imagens e fazer deploy no Run. No Console:

- **Cloud Build → Settings** (ou IAM): garantir que o *Cloud Build service account* tenha:
  - **Cloud Run Admin** (ou permissões equivalentes para `gcloud run deploy`)
  - **Service Account User** na conta que o Cloud Run usa para executar o container
  - **Storage Admin** (ou push para Container Registry / Artifact Registry)

Se o primeiro deploy falhar com permissão, o erro do `gcloud` indica qual papel falta.

---

## 4. Token Mapbox (build)

O mapa precisa de `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` **no momento do `docker build`** (ver `Dockerfile` / `ARG`). Passe via substituição do Cloud Build:

- Valor típico: começa com `pk.ey...` (token **público** de mapas).

---

## 5. Disparar o pipeline (build + push + deploy)

Na **raiz do repositório**:

### Opção A — script npm (usa `git` + variável de ambiente)

```bash
# Linux / macOS / Git Bash
export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="pk.eyJ..."
npm run deploy:cloud-run
```

PowerShell:

```powershell
$env:NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.eyJ..."
npm run deploy:cloud-run
```

### Opção B — comando manual

```bash
COMMIT_SHA=$(git rev-parse HEAD)   # no PowerShell: git rev-parse HEAD
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_COMMIT_SHA=$COMMIT_SHA,_MAPBOX_ACCESS_TOKEN="pk.eyJ..."
```

No **PowerShell** puro:

```powershell
$sha = git rev-parse HEAD
gcloud builds submit --config=cloudbuild.yaml --substitutions="_COMMIT_SHA=$sha,_MAPBOX_ACCESS_TOKEN=pk.eyJ..."
```

O `cloudbuild.yaml`:

1. Faz `docker build` com `--build-arg NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
2. Dá push em `gcr.io/$PROJECT_ID/finmemory:$_COMMIT_SHA` e `:latest`.
3. Executa `gcloud run deploy finmemory` com a imagem versionada.

---

## 6. Variáveis de ambiente no Cloud Run (runtime)

Chaves **secretas** (OpenAI, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, etc.) **não** vão no Dockerfile: configure no serviço:

**Console → Cloud Run → serviço `finmemory` → Editar e implantar nova revisão → Variáveis e segredos**

Inclua pelo menos o que está em `.env.example` para produção (Supabase, NextAuth, Google OAuth, OpenAI, etc.).  
O build já embute `NEXT_PUBLIC_SUPABASE_*` no `Dockerfile`; se mudar o projeto Supabase, **refaça o build** ou passe por build-arg e ajuste o Dockerfile.

---

## 7. Domínio personalizado e OAuth

- Aponte DNS (CNAME) para o URL do Cloud Run ou use **Cloud Load Balancing** + certificado gerenciado.
- No Google Cloud Console (OAuth) e no NextAuth, use a URL **HTTPS final** (ex.: `https://www.finmemory.com.br/api/auth/callback/google`).

---

## 8. Verificação

```bash
gcloud run services describe finmemory --region=southamerica-east1 --format='value(status.url)'
curl -sI "$(gcloud run services describe finmemory --region=southamerica-east1 --format='value(status.url)')"
```

Logs: **Cloud Run → finmemory → Registros**.

---

## 9. Agente de promoções (fora do container web)

O `finmemory-agent` roda em **Cloud Run Job**, **Compute Engine**, **cron local** ou outro scheduler — não é implantado pelo mesmo `cloudbuild.yaml` da app Next, salvo que estendas o pipeline.

- **Guia completo (DIA + Cloud Run Job + timeout):** [finmemory-agent/README.md](../finmemory-agent/README.md)  
- **Todas as redes (tablóides + DIA em `SCRAPERS`):** [PROMO-AGENDAMENTO-PRODUCAO.md](./PROMO-AGENDAMENTO-PRODUCAO.md) — `npm run deploy:promo-agent-all` + `npm run promo:scheduler:setup`.  
- **Imagem só DIA (sem Chromium):** `finmemory-agent/Dockerfile` — build:  
  `docker build -f finmemory-agent/Dockerfile -t finmemory-promo-dia:latest finmemory-agent`  
- No Job só DIA, use **`--task-timeout=5400s`** (ou ≥ `3600s`) para a listagem **SP capital** (~121 lojas).  
- Comando local na raiz do repo: `npm run promo:dia`.

---

## Resumo rápido

| O quê | Onde |
|--------|------|
| Build da imagem | Cloud Build (`cloudbuild.yaml` + `Dockerfile`) |
| App em produção | Cloud Run serviço `finmemory`, região `southamerica-east1` |
| Segredos | Variáveis / Secret Manager no **Cloud Run** |
| Mapbox (build) | `_MAPBOX_ACCESS_TOKEN` na substituição do `gcloud builds submit` |
