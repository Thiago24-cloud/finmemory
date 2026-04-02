# FinMemory — Prompt mestre para Lovable / design / IA (código + visão + gaps)

Cola ou anexa este documento quando fores trabalhar no **Lovable**, no **Cursor** ou com outra ferramenta. Resume **o que o app faz**, **onde está o código**, **o que já existe em produção** e **o que ainda queremos resolver**.

---

## 1. O que é o FinMemory (produto)

**FinMemory** é uma aplicação de **finanças pessoais** e **comunidade de preços**:

- **Recibos e NF-e:** digitalizar/capturar comprovantes, OCR/IA, categorizar, guardar transações (Supabase).
- **Gmail (opcional):** sincronizar e-mails com notas fiscais (`pages/api/gmail/sync.js`).
- **Mapa de preços (“Waze dos preços”):** utilizadores (e bots) partilham **preço + loja + local**; outros veem no mapa; há **promoções agregadas** de supermercados (agente + import DIA).
- **Lista de compras, parcerias, cobranças, relatórios, notificações, calculadora, contas** — várias telas em evolução.

**Público desejado para o mapa:** incluir pessoas que precisam de **orientação rápida** (ex.: ver “onde estou” e “onde há oferta”) **sem** abrir dezenas de pins — ver `DESIGN-BRIEF.md` na raiz.

---

## 2. Stack técnica (monorepo)

| Camada | Tecnologia |
|--------|------------|
| Framework principal | **Next.js 15** (App Router parcial + **Pages Router** dominante) |
| UI | React, Tailwind (vários componentes em `components/`, `src/components/`) |
| Auth | **NextAuth** + Google (`pages/api/auth/[...nextauth].js`) + Supabase adapter |
| Base de dados | **Supabase** (PostgreSQL + RLS) |
| Mapas (produção Next) | **Leaflet** (`components/MapaPrecosLeaflet.js`) + tiles Carto |
| Mapas (alternativa Vite) | **MapLibre** em `src/pages/MapaPrecos.tsx` (pode divergir do Next) |
| Mobile | **Capacitor** (`capacitor.config.json`) — URL de produção típica Cloud Run |
| Deploy típico | **Google Cloud Run** (Docker `cloudbuild.yaml`) |
| Agentes / jobs | `finmemory-agent/agent.js` (Playwright + promoções), `jobs/agent.js`, `scripts/` |

**Importante:** Existem **dois “frontends” de mapa”** no repo:

1. **Produção Next (recomendado alinhar design):** rota **`/mapa`** → `pages/mapa.js` → `components/MapaPrecos.js` → **`MapaPrecosLeaflet.js`**. Usa **`GET /api/map/points`** e **`GET /api/map/stores`** (bbox, merge com `promocoes_supermercados`, filtros promo).
2. **App Vite em `src/`:** rota **`/mapa-precos`** em `src/App.tsx` → **`MapaPrecos.tsx`** com **MapLibre** e leitura direta **`price_points`** no cliente Supabase — **não** replica toda a lógica da API (sem merge promo agente da mesma forma, sem camada `stores` igual). Protótipos Lovable muitas vezes parecem-se com esta rota; **para paridade com produção**, o alvo correto é **`/mapa` + Leaflet** ou portar a mesma API para o protótipo.

---

## 3. Rotas e páginas (Next — `pages/`)

| Rota | Ficheiro | Função resumida |
|------|----------|-----------------|
| `/` | `pages/index.js` | Landing, links legais, CTA |
| `/login` | `pages/login.js` | Login |
| `/dashboard` | `pages/dashboard.js` | Painel principal |
| `/mapa` | `pages/mapa.js` | **Mapa de preços Leaflet** (produção) |
| `/add-receipt` | `pages/add-receipt.js` | Adicionar recibo |
| `/shopping-list` | `pages/shopping-list.js` | Lista de compras |
| `/share-price` | `pages/share-price.js` | Partilhar preço |
| `/settings` | `pages/settings.js` | Definições |
| `/partnership` | `pages/partnership.js` | Parcerias |
| `/reports` | `pages/reports.js` | Relatórios |
| `/categories` | `pages/categories.js` | Categorias |
| `/notifications` | `pages/notifications.js` | Notificações |
| `/manual-entry` | `pages/manual-entry.js` | Entrada manual |
| `/scanner` | `pages/scanner.js` | Scanner |
| `/calculadora` | `pages/calculadora.js` | Calculadora (Next) |
| `/privacidade`, `/termos` | `pages/privacidade.js`, `termos.js` | Legal |
| `/auth/callback`, `/auth-error` | `pages/auth/callback.js`, `auth-error.js` | Auth |

**Rotas React Router** (subapp `src/`, se usada em build Vite/Capacitor): `/dashboard`, `/mapa-precos`, `/contas`, `/calculadora`, `/add-receipt`, `/share-price`, `/manual-entry`, `/partnership`, `/profile`, `/shopping-list`, etc. — ver `src/App.tsx`.

---

## 4. APIs principais (`pages/api/`)

| Endpoint | Ficheiro | Função |
|----------|----------|--------|
| Auth NextAuth | `api/auth/[...nextauth].js` | Sessão Google, cookies, Supabase user |
| Mapa — pontos | `api/map/points.js` | GET: `price_points` + merge **`promocoes_supermercados`**, bbox, TTL, categoria promo; POST: novo preço (autenticado) |
| Mapa — lojas | `api/map/stores.js` | GET: `public.stores` no bbox + cruzamento com promoções / price_points |
| Perguntas mapa | `api/map/questions/*` | Perguntas/respostas sobre pontos (se ativo) |
| OCR / recibo | `api/ocr/process-receipt.js`, `save-transaction.js`, `fetch-nfce.js` | Pipeline recibos/NF-e |
| Gmail | `api/gmail/sync.js` | Sync e-mails |
| Transações | `api/transactions/[id].js`, `publish-to-map.js` | CRUD / publicar no mapa |
| Scrapers | `api/scrapers/import-dia-offers.js` | Import ofertas DIA (GPT + `price_points`) |
| Cobranças | `api/cobrancas/index.js`, `pagamento.js` | Fluxo cobranças |
| Health | `api/health.js` | Saúde do serviço |
| Signup | `api/signup.js` | Registo |

---

## 5. Dados (Supabase — conceito)

- **`price_points`:** preços partilhados pela comunidade (produto, preço, loja, lat/lng, categoria, TTL no API).
- **`public.stores`:** pins de estabelecimentos (nome, tipo, lat/lng, `promo_page_url` opcional para DIA).
- **`promocoes_supermercados`:** ofertas do **agente** (Dia, Atacadão, Carrefour, etc.) — merge no `GET /api/map/points`.
- **Utilizadores / transações / cobranças:** tabelas conforme migrações em `supabase/migrations/`.

---

## 6. Scripts e automação (raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run promo:agent` | Agente Playwright → preenche `promocoes_supermercados` |
| `npm run promo:dia-env` | Gera `.env` com URLs DIA alinhadas a `stores` |
| `npm run mapa-supervisor` | Verifica health + APIs do mapa |
| `npm run dev` | Next dev |
| `npm run cap:sync` | Capacitor sync |

---

## 7. Design / cores

- **`lib/colors.js`:** `CATEGORY_COLORS`, `getCategoryColor`, temas de mapa `MAP_THEMES`.
- **`DESIGN-BRIEF.md`:** objetivos UX para mapa (idoso / auto-localização / pins por rede).
- Pins Leaflet: `createCategoryIcon`, `createStoreIcon` em `MapaPrecosLeaflet.js`.

---

## 8. O que já funciona bem (para não regredir)

- Mapa Next com **duas camadas**: preços (bolhas por categoria) + **lojas** com ícone por tipo (supermercado, farmácia, padaria) e destaque **laranja** se oferta.
- **API** centralizada para TTL, bbox e promoções do agente.
- **Temas de mapa** (tiles) e busca por produto.

---

## 9. Lacunas e soluções que procuramos (prioridade)

### Mapa / UX

1. **Pins genéricos:** pouca diferenciação **entre redes** (Dia vs Carrefour vs …) — queremos **cor da marca / monograma / forma** além do tipo de loja.
2. **“Onde estou”:** marcador de geolocalização óbvio + **recentrar** + possível zoom inicial na zona do utilizador.
3. **Legenda sempre visível** e **filtros grandes** (incl. por rede se dados permitirem).
4. **Resumo da área** (“Nesta zona: X lojas, Y ofertas…”) sem abrir cada popup.
5. **Modo simples** opcional (menos ruído visual).
6. **Paridade:** protótipo em **MapLibre** (`/mapa-precos`) deve **alinharse** à API `/api/map/points` + `/api/map/stores` ou documentar que é só demo.

### Produto / dados

7. **Promoções:** dependem de agente + SQL; mapa vazio se não correr job ou RLS bloquear leitura.
8. **OAuth / domínios:** `NEXTAUTH_URL` deve coincidir com o URL real (Cloud Run vs `finmemory.com.br`); redirects Google limpos.

### Lovable / ferramentas externas

9. **Lovable não importa repo Git existente** oficialmente — fluxo típico é projeto Lovable → GitHub. Para **design**, usar este prompt + `DESIGN-BRIEF.md` e depois **transportar** mudanças para `MapaPrecosLeaflet.js` / `pages/mapa.js` no Cursor.

---

## 10. Prompt curto para colar na Lovable (além deste doc)

> Estamos a evoluir o **FinMemory**: app Next.js com mapa de preços em **Leaflet** (`components/MapaPrecosLeaflet.js`, rota `/mapa`), APIs **`/api/map/points`** e **`/api/map/stores`**, dados Supabase (`price_points`, `stores`, `promocoes_supermercados`). Queremos UI mais clara para utilizadores com pouca paciência em mapas: **minha posição**, **legenda fixa**, **pins distintos por rede de supermercado**, **menos cliques**, **resumo da zona**. Não reinventar backend; foco em **componentes visuais e fluxo**. Lê **`DESIGN-BRIEF.md`** e **`docs/PROMPT-MASTER-FINMEMORY-LOVABLE.md`** no repositório. Se estiveres a usar MapLibre numa rota `/mapa-precos`, indica limitações vs produção `/mapa`.

---

## 11. Variáveis de ambiente (nomes — sem segredos)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (servidor / agente)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY` (OCR, import DIA)
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (se Mapbox usado em algum fluxo)
- `DIA_IMPORT_SECRET`, `DIA_STORE_URL(S)` (agente)

---

## 12. Ficheiros-chave (checklist para PR / Lovable)

```
pages/mapa.js
components/MapaPrecos.js
components/MapaPrecosLeaflet.js
lib/colors.js
pages/api/map/points.js
pages/api/map/stores.js
DESIGN-BRIEF.md
src/pages/MapaPrecos.tsx   (alternativa MapLibre — verificar paridade)
src/App.tsx
finmemory-agent/agent.js
```

---

*Documento gerado para alinhar Lovable + Cursor + roadmap do mapa. Atualiza quando fechares uma milestone (ex.: paridade MapLibre ↔ API).*
