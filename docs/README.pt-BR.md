<div align="center">
  <a href="#root"><img src="./banner.svg?v=2" alt="finmemory · nf-e vira mapa de preços" width="100%"/></a>
</div>

> 🇺🇸 [English version](../README.md) · Produção: [finmemory.com.br](https://finmemory.com.br) · Lojista: [parceiros.finmemory.com.br](https://parceiros.finmemory.com.br)

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <pre lang="bash"><code>$ finmemory / briefing
------------------------------------------
• domínio  : gmail → nf-e → mapa de preços BR
• monorepo : 4 apps + 2 packages (workspaces)
• mapa     : leaflet + supercluster, ttl 24h
• scrapers : playwright · 11 redes · 3 crons
• pagtos   : stripe · cielo · stone pos
• open fin : pluggy</code></pre>
    </td>
    <td width="50%" valign="top">
      <pre lang="python"><code>class FinMemory:
    apps   = ["consumer :3000", "retailer :3001",
              "agent (playwright)",
              "android (capacitor + stone)"]
    data   = "supabase pg + next-auth"
    ia     = ["gpt-4o-mini", "gemini/cse", "onnx wasm"]
    deploy = "cloud build → cloud run · sa-east1"</code></pre>
    </td>
  </tr>
</table>

### ❯ badges

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-15.5-0a0f1a?style=flat-square&logo=nextdotjs&logoColor=ffffff&labelColor=0a0f1a&color=2ecc49" alt="Next.js 15.5" />
  <img src="https://img.shields.io/badge/React-18.3-0a0f1a?style=flat-square&logo=react&logoColor=61dafb&labelColor=0a0f1a&color=141c2e" alt="React 18" />
  <img src="https://img.shields.io/badge/Supabase-2.45-0a0f1a?style=flat-square&logo=supabase&logoColor=3ecf8e&labelColor=0a0f1a&color=3ecf8e" alt="Supabase" />
  <img src="https://img.shields.io/badge/Playwright-1.62-0a0f1a?style=flat-square&logo=playwright&logoColor=2ead33&labelColor=0a0f1a&color=2ead33" alt="Playwright" />
  <img src="https://img.shields.io/badge/Cloud_Run-sa--east1-0a0f1a?style=flat-square&logo=googlecloud&logoColor=4285f4&labelColor=0a0f1a&color=4285f4" alt="Cloud Run" />
  <img src="https://img.shields.io/badge/license-MIT-0a0f1a?style=flat-square&labelColor=0a0f1a&color=6272a4" alt="MIT" />
</p>

---

### ❯ o_que_e

O FinMemory é um monorepo fintech brasileiro. O app do consumidor conecta no
Gmail (somente leitura), puxa NF-e e cupons da caixa de entrada, extrai os itens
com um parser de IA e transforma o histórico de compras em duas coisas: um
dashboard do que você gastou e um mapa de preços ao vivo do que os mercados ao
redor estão cobrando. Em volta desse núcleo há um app para o lojista (OCR de
nota de papel, pagamentos Cielo, scanner de prateleira em ONNX), um agente
Playwright que coleta promoções de 11 redes de mercado e sincronização de open
finance via Pluggy.

---

### ❯ pipeline

<div align="center">
  <img src="./pipeline.svg?v=2" alt="Pipeline: gmail/scrapers/retailer → ingestão → supabase → apps" width="100%"/>
</div>

Todo scraper escreve via `enqueuePromocoes()` em `apps/consumer/lib/ingest` com
tag de `origem` (`scraper_dia`, `scraper_assai`, ...). Fluxos manuais (OCR do
usuário, Quick Add, admin) podem escrever em `price_points` diretamente. Esse
contrato é regra de projeto, não convenção.

---

### ❯ monorepo

npm workspaces. Um único `.env` na raiz alimenta todos os apps (o
`next.config.ts` do consumer carrega via dotenv; os scripts usam
`-r dotenv/config`).

| dir | package | o que é | dev |
|---|---|---|---|
| `apps/consumer` | `@finmemory/consumer` | app do consumidor: sync do Gmail, dashboard, `/mapa`, API routes | `npm run dev` → :3000 |
| `apps/retailer` | `@finmemory/retailer` | app do lojista: OCR de nota, Cielo, cardápio, visão de estoque ONNX | `npm run dev:retailer` → :3001 |
| `apps/retailer-android` | Kotlin/Gradle | app nativo p/ SmartPOS Stone, fila offline em Room → `POST /api/merchant/vendas` | `./gradlew :app:assembleDebug` |
| `finmemory-agent` | `finmemory-agent` | agente Playwright de promoções, Docker (`Dockerfile.all`) | `npm run promo:agent:dry` |
| `packages/shared` | `@finmemory/shared` | RBAC, client Supabase, Cielo, validação, Cosmos | lib |
| `packages/ui-components` | `@finmemory/ui` | tokens de marca + preset Tailwind | lib |
| `android/` + `ios/` | Capacitor 8 | shell mobile do consumer (`capacitor.config.json`) | `npm run cap:sync` |

---

### ❯ mapa_de_precos

- `/mapa` renderiza lojas e preços com pins `divIcon` do Leaflet, tiles MapLibre
  e supercluster. Pins de promoção têm cor própria para a oferta aparecer já no
  zoom afastado.
- `pages/api/map/stores.js` serve lojas por bbox; `pages/api/map/points.js`
  serve pontos de preço com TTL de 24h.
- Thumbnails de produto são preenchidas por cron com Gemini + Google CSE
  (`pages/api/cron/backfill-map-images.js`, scripts `map:backfill-images*`).
- Aprofundamentos: [MAPA-PRECOS-PROMOCOES-ESTRATEGIA.md](MAPA-PRECOS-PROMOCOES-ESTRATEGIA.md),
  [DESIGN-BRIEF.md](../DESIGN-BRIEF.md).

---

### ❯ scrapers_e_crons

O `finmemory-agent` roda Playwright (headed ou headless) contra 11 redes:
`dia`, `assai`, `carrefour`, `sonda`, `paodeacucar`, `hirota`, `saojorge`,
`mambo`, `agape`, `armazemdocampo`, além de `atacadao` via rota HTTP
(`pages/api/scraper/atacadao.js`).

| workflow | agenda (UTC) | alvo |
|---|---|---|
| `scraper-dia-cron.yml` | dom 05:00 | lotes Grande SP → `POST /api/scraper/dia` |
| `scraper-atacadao-cron.yml` | dom 06:00 | `POST /api/scraper/atacadao` |
| `reengagement-cron.yml` | diário 14:00 | `POST` de reengajamento de usuários inativos |

Rodar local: `npm run promo:dia`, `npm run promo:p1` (Assaí+Carrefour),
`npm run promo:regional` (saojorge/mambo/agape/armazemdocampo/sonda). Detalhes
do agente: [finmemory-agent/README.md](../finmemory-agent/README.md).

---

### ❯ stack

| camada | tech |
|---|---|
| consumer | Next.js 15.5 (Pages Router), React 18.3, Tailwind 3.4, Radix UI, next-auth 4 + `@next-auth/supabase-adapter` |
| retailer | Next.js 15.5, onnxruntime-web, @zxing, sonner |
| ia | OpenAI 4.77 (parse gpt-4o-mini), `@google/generative-ai` + Google CSE (imagens de produto) |
| dados | Supabase 2.45 (postgres + RLS), googleapis 144 (`gmail.readonly`) |
| mapa | leaflet 1.9, maplibre-gl 5, supercluster 8, react-leaflet |
| pagamentos | Stripe 22 (`create-checkout-session`), Cielo e-Commerce (`payments/cielo`) |
| open finance | pluggy-sdk + react-pluggy-connect (`pages/api/pluggy/*`) |
| agente | Playwright 1.62, p-limit, supabase-js |
| mobile | Capacitor 8 (shell do consumer), Kotlin + Room + Koin (Stone SmartPOS) |
| observabilidade | posthog-js |
| testes | vitest 3.2.4 (`npm test`), scripts `promo:test-*`, `auth:test-*` |

---

### ❯ deploy

Docker multi-stage → Cloud Build (`cloudbuild.yaml`, `cloudbuild.retailer.yaml`,
`cloudbuild-promo-agent-all.yaml`) → Cloud Run `southamerica-east1` (serviços
`finmemory` e `finmemory-retailer`). Firebase Hosting serve os targets estáticos
(`firebase.json`); o `Dockerfile` da raiz compila o consumer em modo standalone
do Next.

```bash
npm run deploy:cloud-run            # consumer
npm run deploy:cloud-run:retailer   # retailer
npm run deploy:promo-agent-all      # agente de promoções
```

Runbooks: [DEPLOY-GOOGLE-CLOUD-RUN.md](DEPLOY-GOOGLE-CLOUD-RUN.md),
[CHECKLIST-CLOUD-RUN-ENV.md](../CHECKLIST-CLOUD-RUN-ENV.md). O `.env.production`
é versionado de propósito e só contém `NEXT_PUBLIC_*`; segredos de verdade ficam
no env do Cloud Run.

---

### ❯ quickstart

```bash
git clone https://github.com/Thiago24-cloud/finmemory.git
cd finmemory
npm install              # workspaces + patch-package
cp .env.example .env     # .env raiz alimenta consumer, retailer e scripts
npm run validate-env     # diagnóstico antes de subir

npm run dev              # consumer  → http://localhost:3000
npm run dev:retailer     # retailer  → http://localhost:3001
npm test                 # vitest run
npm run promo:agent:dry  # dry-run do agente de promoções
```

Grupos de variáveis no `.env.example`: Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), Google OAuth
(`GOOGLE_CLIENT_ID/SECRET`, redirect URIs), `OPENAI_API_KEY`, NextAuth, Pluggy,
Stripe, Cielo, PostHog, URLs do Cloud Run.

---

### ❯ estrutura

<pre lang="text"><code>apps/consumer/pages/         index, dashboard, mapa, checkout, admin/*
apps/consumer/pages/api/     gmail, map/{stores,points,...}, scraper{s,}, pluggy,
                             payments/cielo, open-finance, cron, shopping-list
apps/consumer/lib/           ingest, diaScraper, sondaScraper, atacadaoScraper,
                             cielo, pluggy*
apps/retailer/               lojista: auth, OCR, vendas, visão ONNX
apps/retailer-android/       Kotlin/Stone: SecureTokenStore, SaleSyncRepository
finmemory-agent/             agent.js + lib/ + Dockerfiles
packages/shared/             rbac · supabase · cielo · cosmos · validation
.github/workflows/           3 crons (dia, atacadao, reengagement)
docs/                        runbooks, SQL, este arquivo</code></pre>

---

### ❯ licença

MIT, veja [LICENSE](../LICENSE) · [@Thiago24-cloud](https://github.com/Thiago24-cloud)
