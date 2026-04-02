# Agendar promoções de **todas** as redes no mapa (produção)

O `finmemory-agent` grava em `promocoes_supermercados` todas as chaves de `SCRAPERS` quando corre **`node agent.js`** sem `--only`: **dia**, **atacadao**, **assai**, **carrefour**, **paodeacucar**, **hirota**, **lopes**, **sonda**, **saojorge**, **mambo**, **agape**, **armazemdocampo**.

## 1. APIs GCP (uma vez)

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com cloudscheduler.googleapis.com --project=SEU_PROJETO
```

## 2. Imagem + Cloud Run Job

Na **raiz** do repositório, com `.env.local` contendo `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run deploy:promo-agent-all
```

Isto faz:

- Cloud Build com `cloudbuild-promo-agent-all.yaml` → `gcr.io/PROJETO/finmemory-promo-agent-all:TAG`
- Deploy do job **`finmemory-promo-agent-all`** (timeout padrão **4 h**, memória **4 Gi**, **2** CPUs)

Variáveis opcionais no ambiente antes do comando:

| Variável | Efeito |
|----------|--------|
| `GCLOUD_PROJECT` | Projeto GCP (default `exalted-entry-480904-s9`) |
| `PROMO_JOB_TASK_TIMEOUT_S` | Timeout da tarefa em segundos (máx. 86400; default 14400) |
| `PROMO_JOB_MEMORY` / `PROMO_JOB_CPU` | Recursos do job |
| `TTL_HOURS`, `CONCURRENCY`, `DIA_MAX_STORE_PAGES`, `DIA_REGION_PAGE_PATHS` | Repassadas ao agente |

**Segurança:** o script usa `--set-env-vars` com a service role. Para produção mais estrita, migra a chave para **Secret Manager** e altera o deploy para `--set-secrets`.

## 3. Cloud Scheduler (2× por dia)

Depois do job existir:

**Windows (PowerShell):**

```powershell
npm run promo:scheduler:setup
```

**Linux / macOS / Cloud Shell:**

```bash
npm run promo:scheduler:setup:sh
```

Cria a conta `finmemory-promo-scheduler@...` com `roles/run.developer` e dois agendamentos (fuso **America/Sao_Paulo**):

- **07:30** — `finmemory-promo-all-am`
- **19:00** — `finmemory-promo-all-pm`

Ajusta horários editando `scripts/setup-promo-scheduler.ps1` ou `.sh`.

## 4. Teste manual

```bash
gcloud run jobs execute finmemory-promo-agent-all --region=southamerica-east1 --project=SEU_PROJETO --wait
```

## 5. Job só DIA (imagem leve, sem Chromium)

Continua disponível: `finmemory-agent/Dockerfile` + `npm run docker:build:promo-dia` e o fluxo em `finmemory-agent/README.md`. O job “todas as redes” **inclui** DIA de novo; se quiseres evitar duplicação de carga, usa **ou** o job completo **ou** o job só DIA + outro com `--only=atacadao,carrefour,...` (personaliza o `CMD` da imagem ou cria um segundo job).

## 6. Import HTML + GPT (loja DIA específica)

Isto **não** substitui o agente: é o endpoint `POST /api/scrapers/import-dia-offers` (pins em `price_points`). Podes agendar com Cloud Scheduler chamando esse URL no **Cloud Run da app** (HTTP autenticado + `DIA_IMPORT_SECRET`), se precisares de ofertas “página da loja” além do `page-data`.
