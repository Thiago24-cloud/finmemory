# finmemory-agent — promoções (mapa)

Agente Node (Playwright + `fetch`) que grava em `promocoes_supermercados` no Supabase.

## DIA — capital SP (job completo)

- **~121 lojas** (slugs `sp-sao-paulo-*` a partir de `page-data/lojas-sp-capital`; o JSON traz mais nós, ignorados por defeito).
- **`DIA_MAX_STORE_PAGES`** por defeito **250** (cobre todas num único job).
- **Local / cron na VM:** na raiz do monorepo, com `.env` contendo `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) e `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run promo:dia
```

- **Teste sem gravar:** `npm run promo:agent:dry` (corre todas as redes) ou `cd finmemory-agent && node agent.js --dry-run --only=dia`.

## Cloud Run Job (timeout)

O job **só DIA** faz dezenas de minutos na primeira volta (~121 pedidos sequenciais + pausas). Define **task timeout** com folga, por exemplo **5400 s** (90 min) ou **3600 s** (60 min) no mínimo.

### 1. Build e push da imagem

Substitui `PROJECT`, `REGION` e o repositório Artifact Registry.

```bash
# A partir da raiz do repositório FinMemory
docker build -f finmemory-agent/Dockerfile -t REGION-docker.pkg.dev/PROJECT/finmemory/finmemory-promo-dia:latest finmemory-agent
docker push REGION-docker.pkg.dev/PROJECT/finmemory/finmemory-promo-dia:latest
```

(Exemplo de região: `southamerica-east1`.)

### 2. Criar ou atualizar o Job

```bash
gcloud run jobs deploy finmemory-promo-dia \
  --image=REGION-docker.pkg.dev/PROJECT/finmemory/finmemory-promo-dia:latest \
  --region=southamerica-east1 \
  --tasks=1 \
  --max-retries=0 \
  --task-timeout=5400s \
  --set-env-vars="SUPABASE_URL=https://SEU_PROJETO.supabase.co,SUPABASE_SERVICE_ROLE_KEY=COLE_A_SERVICE_ROLE_AQUI"
```

Ajusta `set-env-vars` ou usa **Secret Manager** (`--set-secrets`) para a service key.

### 3. Executar manualmente

```bash
gcloud run jobs execute finmemory-promo-dia --region=southamerica-east1 --wait
```

### 4. Cloud Scheduler (opcional)

Cria um scheduler que chama `gcloud run jobs execute` ou a API **run.googleapis.com** com OIDC, na cadência desejada (ex.: 1×/dia).

## Variáveis úteis (DIA)

| Variável | Efeito |
|----------|--------|
| `DIA_MAX_STORE_PAGES` | Máximo de URLs de loja por execução (default **250**). |
| `DIA_REGION_PAGE_PATHS` | Rotas Gatsby (default `lojas-sp-capital`). |
| `DIA_SKIP_REGION_LIST=1` | Não expande listagem; só `DIA_STORE_URL(S)` + Supabase. |
| `DIA_REGION_INCLUDE_ALL_NODES=1` | Inclui todos os nós do JSON da capital (inclui cidades fora de SP capital). |

Documentação alinhada ao mapa: `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md`.

## Outras redes

O `Dockerfile` desta pasta é otimizado para **`--only=dia`** (sem browser). Para Atacadão, Carrefour, etc., o agente precisa de **Chromium**.

### Todas as redes em produção (Cloud Run Job + Scheduler)

- **`Dockerfile.all`** — base `mcr.microsoft.com/playwright:v1.58.2-noble`, `CMD ["node","agent.js"]` (todas as chaves em `SCRAPERS`).
- Na **raiz do monorepo**: `npm run deploy:promo-agent-all` (build no Cloud Build + deploy do job `finmemory-promo-agent-all`).
- Agendar **2×/dia**: `npm run promo:scheduler:setup` (PowerShell) ou `npm run promo:scheduler:setup:sh`.
- Guia: **`docs/PROMO-AGENDAMENTO-PRODUCAO.md`**.

Build local da imagem completa: `npm run docker:build:promo-agent-all` (na raiz).
