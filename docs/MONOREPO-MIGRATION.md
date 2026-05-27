# Monorepo FinMemory — Plano de migração

## Estrutura atual (Fase 2)

```
finmemory/
├── package.json                 workspaces + scripts orquestradores
├── apps/
│   ├── consumer/                @finmemory/consumer — Next.js (produção)
│   │   ├── pages/ components/ lib/ public/ styles/
│   │   ├── next.config.ts middleware.js
│   │   └── package.json
│   └── retailer/                @finmemory/retailer — painel lojista (porta 3001)
├── packages/
│   ├── shared/                  @finmemory/shared
│   └── ui-components/           @finmemory/ui
├── finmemory-agent/
├── supabase/
├── scripts/                     deploy, verify-build, crons
├── Dockerfile                   build monorepo → apps/consumer
└── .env.local                   na raiz (carregado pelo next.config)
```

## Comandos

```bash
npm install
npm run dev          # next dev em apps/consumer
npm run dev:retailer # next dev em apps/retailer (:3001)
npm run build        # build + verify standalone (consumer)
npm run build:retailer
npm run build:all    # consumer + retailer
npm run start        # next start
```

## Variáveis de ambiente

O `.env.local` permanece na **raiz do monorepo**. O `apps/consumer/next.config.ts` carrega:

- `../../.env`
- `../../.env.local`
- `../../.env.production`

Scripts em `scripts/` continuam usando `dotenv` na raiz.

## Deploy Cloud Run

O `Dockerfile` na raiz:

1. `npm install` com workspaces (`packages/` + `apps/consumer/`)
2. `WORKDIR apps/consumer` → `npm run build`
3. Runner: `node apps/consumer/server.js` (standalone aninhado)

`npm run deploy:cloud-run` inalterado na raiz.

## Pacotes compartilhados

| Pacote | Import |
|--------|--------|
| `@finmemory/shared` | RBAC, auth, validation, format, Supabase |
| `@finmemory/ui` | tokens, PricePin, Sheet, cn |

## Fase 3 — limpeza lojista no consumer (✅)

**Removido** do `@finmemory/consumer`: cadastro/painel/inventário/onboarding lojista (`/parceiros`, `/parceiros/painel`, `/escolher-perfil`, APIs `partners/*`, `merchant/*`, `varejo/*`, componentes `AccountType*`, `MerchantPanel*`, etc.).

**Mantido** (fluxo consumidor):
- Pickup no mapa: `MerchantPickupOrderButton`, `/api/parceiros/pedidos/*`, `/pedido/[id]`
- Ofertas de lojas: `/api/map/produtos-proximos`
- Push de pedidos: `lib/push/merchantOrderPush.js` (notifica lojista; URL do painel aponta para `apps/retailer` futuro)

`UserRoleContext` fixo em `consumer`. Build e testes passam após a limpeza.

## Fase 4 — `apps/retailer` (✅)

App Next.js separado para lojistas (`@finmemory/retailer`), porta **3001** em dev.

**Rotas principais:**
- `/parceiros` — landing + cadastro
- `/parceiros/painel` — inventário, pedidos, Stripe Connect
- `/escolher-perfil` — onboarding lojista
- `/historico-inventario-varejo` — lotes CSV

**APIs:** `/api/parceiros/painel/*`, `/api/merchant/*`, `/api/partners/*`, `/api/varejo/*`

**Pickup consumidor** permanece no `@finmemory/consumer` (`/api/parceiros/pedidos/*`).

```bash
npm run dev:retailer      # localhost:3001
npm run build:retailer
npm run build:all         # consumer + retailer
```

Variável opcional: `NEXT_PUBLIC_RETAILER_APP_URL` — URL pública do app lojista (push OneSignal, links).

Restaurar arquivos do git HEAD: `node scripts/restore-retailer-app.mjs`

## Fases

| Fase | Status |
|------|--------|
| 0 | ✅ Workspaces + packages/shared, ui |
| 1 | ✅ Extrair módulos para shared/ui |
| 2 | ✅ App em `apps/consumer` |
| 3 | ✅ Remover legado lojista do consumer |
| 4 | ✅ `apps/retailer` |
| 5 | ⏳ RBAC + Realtime |

## Fase 1 — módulos extraídos

Ver histórico no git; re-exports em `apps/consumer/lib/` para compatibilidade gradual.
