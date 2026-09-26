# FinMemory Credits MVP — FinMemory Comerciantes

MVP de **carteira de créditos**, **campanhas patrocinadas** e **validação de compra**, com camada **blockchain-ready** (hash mock).

**Deploy:** serviço Cloud Run `finmemorycomerciantes` (`apps/retailer`).

## Escopo

| Módulo | Descrição |
|--------|-----------|
| Carteira | Saldo `FM_CREDIT` (1 crédito = R$ 1,00 de benefício) |
| Ledger | Histórico imutável de movimentações |
| Campanhas | Parceiro financia cashback por produto/região/orçamento |
| Validação | Compra simulada → crédito → atualiza `budget_spent` |
| Auditoria | `BLOCKCHAIN_AUDIT_MOCK=true` grava hash `0x…` (stub testnet) |

**Não altera** mapa consumidor, scrapers nem ADM Compra existente.

## Migration (Supabase compartilhado)

Arquivo: `supabase/migrations/20260725120000_fm_credits_wallet_campaign.sql`

Aplicar no SQL Editor do Supabase ou `npx supabase db push`.

## Variáveis — Cloud Run `finmemorycomerciantes`

```env
BLOCKCHAIN_AUDIT_MOCK=true
BLOCKCHAIN_AUDIT_NETWORK=finmemory-mock-testnet
FM_DEMO_USER_EMAIL=seu@email.com
FINMEMORY_ADMIN_EMAILS=admin@...
```

## Seed demo

```bash
node -r dotenv/config scripts/seed-fm-credits-demo.mjs
```

## Rotas (retailer / parceiros)

### Comerciante (logado)
- `/parceiros/carteira` — saldo + histórico
- `GET /api/parceiros/credits/wallet`

### Admin ADM (`FINMEMORY_ADMIN_EMAILS`)
- `/parceiros/adm/credit-campaigns`
- `/parceiros/adm/credit-validate`
- `/parceiros/demo/investor`
- `GET/POST /api/parceiros/adm/campaigns`
- `PATCH /api/parceiros/adm/campaigns/[id]`
- `POST /api/parceiros/adm/campaigns/validate-purchase`
- `GET /api/parceiros/demo/investor`

Links também no header do **ADM FinMemory Compra** (`/parceiros/adm`) e no dashboard do painel (`/parceiros/painel`).

## Lib

`apps/retailer/lib/credits/`

## Deploy

```bash
npm run deploy:cloud-run:retailer
```

Ou script PowerShell `scripts/set-cloud-run-env-retailer.ps1` para env vars.
