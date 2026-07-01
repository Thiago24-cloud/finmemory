# GitHub Actions — dois apps, um mapa

FinMemory tem **dois frontends** e **um banco** (Supabase). O mapa é o mesmo nos dois; só muda de onde você abre.

| App | Domínio típico | O que faz |
|-----|----------------|-----------|
| **Consumidor** | `https://finmemory.com.br` | Mapa completo, scrapers, OCR, pagamentos |
| **Parceiros (lojista)** | `https://parceiros.finmemory.com.br` | Painel lojista; `/mapa` **redireciona** para o mapa do consumidor |

Os scrapers (`/api/scraper/dia`, `/api/scraper/atacadao`) existem **só no app consumidor**.  
Atualizar promoções **uma vez** no consumer alimenta o mapa nos **dois** domínios.

## Secrets no GitHub (Settings → Secrets → Actions)

### Obrigatórios para scrapers

| Secret | Valor | Uso |
|--------|--------|-----|
| `CONSUMER_APP_URL` | `https://finmemory.com.br` | **Scrapers DIA e Atacadão** |
| `DIA_IMPORT_SECRET` | Igual ao Cloud Run **consumer** | Autenticação cron DIA |
| `ATACADAO_IMPORT_SECRET` | Igual ao Cloud Run consumer | Autenticação cron Atacadão |

Aliases aceitos pelos workflows (legado):

- `CONSUMER_APP_URL` ← preferido  
- `FINMEMORY_APP_URL` ou `APP_URL` — **desde que** seja `finmemory.com.br`, **não** parceiros

### Parceiros (opcional, monitoramento)

| Secret | Valor | Uso |
|--------|--------|-----|
| `RETAILER_APP_URL` | `https://parceiros.finmemory.com.br` | Health check após scraper; não roda import |
| `PARCEIROS_APP_URL` | (alias de `RETAILER_APP_URL`) | Idem |

### Reengagement (cron diário)

| Secret | Valor |
|--------|--------|
| `CONSUMER_APP_URL` | `https://finmemory.com.br` |
| `CRON_SECRET` | Cloud Run consumer (**ou** reutilize `DIA_IMPORT_SECRET`) |

## O que **não** fazer

- Colocar `https://parceiros.finmemory.com.br` em `CONSUMER_APP_URL` / `APP_URL` dos scrapers → **HTTP 404** (não existe `/api/scraper/*` no retailer).
- Achar que precisa rodar o scraper duas vezes (uma por domínio). **Uma execução no consumer** basta.

## Testar localmente

```bash
node -r dotenv/config scripts/github-scraper-secrets-check.mjs
```

Defina no `.env.local` (opcional):

```env
CONSUMER_APP_URL=https://finmemory.com.br
RETAILER_APP_URL=https://parceiros.finmemory.com.br
```

## Workflows

| Workflow | App alvo |
|----------|----------|
| `scraper-dia-cron.yml` | Consumer |
| `scraper-atacadao-cron.yml` | Consumer |
| `reengagement-cron.yml` | Consumer |

Após cada scraper com sucesso, se `RETAILER_APP_URL` estiver definido, o workflow faz `GET /api/health` no parceiros (só confirma que o app lojista está no ar).

## Ver também

- `docs/DIA-CRON-AUTOMATICO.md`
- `apps/retailer/pages/mapa.js` — redirect para `finmemory.com.br/mapa?from=parceiros`
