# DIA — cron automático de domingo (como antes)

O fluxo volta a ser **automático**: todo **domingo 02:00 (horário de Brasília)** o GitHub Actions chama o app em produção; o **Cloud Run** usa sua **`ANTHROPIC_API_KEY`** para extrair ofertas e publicar no mapa (sem admin).

## Como funciona

```
Domingo 02:00 BRT
    → GitHub Actions (.github/workflows/scraper-dia-cron.yml)
    → POST https://…run.app/api/scraper/dia  (8 lotes × 25 lojas Grande SP)
    → Cloud Run + ANTHROPIC_API_KEY
    → price_points (mapa) direto
```

O **Cursor** e o **`.env.local`** servem para desenvolver. O cron **não** roda no seu PC.

## Passo 1 — Cloud Run (sua API Anthropic)

No `.env.local` você já tem `ANTHROPIC_API_KEY`. Envie para produção:

```powershell
.\scripts\set-cloud-run-env.ps1
```

Confira também no `.env.local`:

| Variável | Para quê |
|----------|----------|
| `ANTHROPIC_API_KEY` | Extração das ofertas (obrigatório no servidor) |
| `DIA_IMPORT_SECRET` | Protege `/api/scraper/dia` |
| `BOT_PROMO_OWNER_USER_ID` | UUID da conta técnica (`npm run promo:ensure-bot-owner`) — **não** use e-mail de admin |

Opcional: o mesmo UUID em `DIA_BOT_USER_ID` e `MAP_QUICK_ADD_BOT_USER_ID`.

## Passo 2 — GitHub Secrets (só 2)

Repositório → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor |
|--------|--------|
| `APP_URL` | `https://finmemory-836908221936.southamerica-east1.run.app` |
| `DIA_IMPORT_SECRET` | **Igual** ao do `.env.local` / Cloud Run |

(Opcional: `FINMEMORY_APP_URL` em vez de `APP_URL`.)

## Passo 3 — Testar sem esperar domingo

GitHub → **Actions** → **Scraper DIA — Cron Semanal** → **Run workflow** → `max_batches` = `1` (teste rápido) ou `8` (ciclo completo).

## O que mudou em relação ao “só 25 lojas”

Antes o cron mandava **um lote** por domingo (~25 lojas). Agora são **até 8 lotes** (~183 lojas Grande SP, sem interior), alinhado à segunda-feira com preços novos.

## Atacadão

Cron separado: `.github/workflows/scraper-atacadao-cron.yml` (domingo 03:00 BRT). Mesmo `APP_URL` + secret `ATACADAO_IMPORT_SECRET` se usar.
