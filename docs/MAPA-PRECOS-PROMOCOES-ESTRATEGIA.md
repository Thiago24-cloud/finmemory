# Mapa de preços — estratégia de promoções e performance

Checklist operacional (priorizar redes P1/P2/P3, SQL no Supabase, comandos `npm run promo:*`): **`docs/CHECKLIST-PROMOCOES-POR-REDE.md`**.  
URLs por rede, agregadores e o que evitar (delivery vs gôndola): **`docs/TABLOIDES-FONTES-REDES-SP.md`**.

## Como o FinMemory já funciona (base para repetir)

| Camada | Papel |
|--------|--------|
| **`price_points`** | Preços da comunidade + importações (ex.: DIA) com `category` contendo `promo` para ofertas. |
| **`promocoes_supermercados`** | Itens do agente (várias redes mapeadas no código de `points.js`). |
| **`public.stores`** | Pins verde/laranja das lojas; `tem_oferta_hoje` liga ofertas recentes ao popup. |
| **`GET /api/map/points`** | TTL curto para preços normais; TTL maior para promo (`MAP_PROMO_TTL_HOURS`). |
| **`POST /api/scrapers/import-dia-offers`** | Modelo de import por URL de loja + GPT — ver `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md`. |

## Encher o mapa de descontos (todas as redes do agente)

1. **Lojas no banco:** quanto mais linhas em `public.stores` (DIA, Carrefour, Assaí, etc.), melhor o agente posiciona ofertas no mapa (`getChainCoordsFallback`).
2. **Rodar o agente** (Playwright + Supabase) na pasta do agente, com `.env` ou variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Opcional: `DIA_STORE_URL` (URL da página de **uma loja** no site do DIA)
3. Na **raiz do monorepo:**
   ```bash
   cd finmemory-agent && npm install
   cd .. && npm run promo:agent
   ```
   Ou só uma rede: `cd finmemory-agent && node agent.js --only=dia,carrefour`
4. **Dry-run** (não grava): `npm run promo:agent:dry`
5. No app, o mapa `/mapa` abre com **“Só promo”** ligado por defeito para destacar descontos.

## Estratégia para novas redes (site / app / redes sociais)

1. **Fonte de verdade** — Definir por rede: página de loja, API pública, feed JSON, ou captura estável (evitar só “print do Instagram” sem URL estável).
2. **Normalizar saída** — Sempre gerar: `store_name` alinhado a `stores.name`, `lat`/`lng` (loja real), `product_name`, preço ou encarte (`promo_image_url` / `imagem_url`), `category` tipo `Supermercado - Promoção`.
3. **Ingestão** — Preferir um endpoint `POST /api/scrapers/import-<rede>-offers` (mesmo padrão do DIA) ou job que escreve em `promocoes_supermercados` com `expira_em`.
4. **Deduplicação** — Antes de inserir, apagar/atualizar ofertas da mesma loja nas últimas 24h (como no DIA) para não explodir o mapa.
5. **Atualização** — Cloud Scheduler / cron chamando o endpoint a cada X horas (manhã + fim de tarde costuma bastar para “oferta do dia”).
6. **Legal** — Respeitar ToS do site/rede; para redes sociais, priorizar links oficiais ou parcerias.

---

## Cobertura “todas as redes” (mesmo padrão do DIA / agente)

Objetivo de produto: **o máximo possível** de supermercados com produtos de desconto visíveis no FinMemory (mapa + filtros), sem prometer 100% só por existir post no Instagram — isso exige **fonte técnica repetível** por rede.

### Ordem de prioridade (por estabilidade)

| Prioridade | Fonte | Por quê |
|------------|--------|--------|
| 1 | **Site oficial** — página de ofertas, loja ou encarte (HTML/PDF) | URL estável, mesmo padrão do `import-dia-offers` (fetch + texto/HTML + GPT) ou scraper Playwright em `finmemory-agent/agent.js` (`SCRAPERS.<rede>`). |
| 2 | **API / JSON / app** — se a rede expuser catálogo ou tabloide digital | Menos frágil que layout de página; documentar endpoint e contrato. |
| 3 | **Link em post (IG/FB)** — quando o post só **aponta** para encarte ou página no site | Tratar como (1): o job segue o link e importa do site, não do embed social. |
| 4 | **Só Instagram/Facebook** — galeria de fotos, stories, texto solto | **Baixa prioridade para automação:** HTML dinâmico, login, anti-bot, ToS; custo alto e quebra frequente. Melhor: parceria, CSV manual, ou “link oficial do encarte” no fluxo editorial. |

### Padrão de trabalho (repetir para cada nova rede)

1. **Cadastro de lojas** — Garantir linhas em `public.stores` (nome + `lat`/`lng` + `type`) para a rede; sem isso o mapa não associa oferta ao pin certo (`pages/api/map/stores.js`).
2. **Escolher veio de ingestão** —  
   - *Site com página de loja tipo DIA* → `POST /api/scrapers/import-dia-offers` (ajustar prompt/URL se for outro domínio) **ou** novo `import-<rede>-offers.js` copiando o mesmo fluxo (segredo opcional, GPT, `price_points`, dedup 24h).  
   - *Página nacional de ofertas* → entrada em `SCRAPERS` no `finmemory-agent/agent.js` + `node agent.js --only=<rede>` em cron.
3. **Alinhar nomes** — `store_name` / `store_name` nas ofertas **igual** (ou muito próximo) a `stores.name` e coordenadas da loja; ver SQL de correção em `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md`.
4. **Agendar** — Cloud Scheduler (ou cron) 1–2x/dia em horário de troca de oferta; manter `OPENAI_API_KEY` / Playwright onde aplicável.
5. **Validar no app** — `/mapa`, filtro “Só promo”, pin laranja e popup da loja.

### Redes já mapeadas no agente (código)

Ver objeto `SCRAPERS` em `finmemory-agent/agent.js` (inclui `dia`, `atacadao`, `assai`, `carrefour`, `paodeacucar`, `hirota`, `lopes`, `sonda`, `saojorge`, `mambo`, `agape`, `armazemdocampo`, …). Para **cada** uma: manter URL atualizada, lojas em `stores`, e monitorar quando o site mudar o HTML (ajuste de seletores).

| Slug (`supermercado`) | Página usada pelo scraper |
|------------------------|---------------------------|
| `mambo` | `mambo.com.br/lista-rapida` (site pode ser SPA — revisar seletores se vier 0 itens) |
| `agape` | `agapedelivery.com.br/agape/promocoes-99999` |
| `armazemdocampo` | Loja Shopify `armazemdocampo.shop/collections/all` |

### Instagram / Facebook em escala

- **Não** substituem site como fonte principal: usar posts só para descobrir **URL do encarte** ou campanha no **site oficial**, e importar dali.
- Se no futuro houver parceria ou API oficial da rede, documentar aqui e fixar um único job por rede.

### Definição de “pronto” por rede

- [ ] Loja(s) em `stores` com coordenadas corretas  
- [ ] Job ou POST testado em staging/produção  
- [ ] Nome da loja nas ofertas bate com `stores`  
- [ ] Cron ativo e alerta se 0 ofertas por X dias (opcional: `mapa-supervisor` / logs)

## Mapa fluido (implementado + recomendações)

### Já no código

- **Agrupamento** — Vários preços no mesmo `lat/lng` viram um círculo com contagem (`groupPointsByLocation`).
- **Viewport** — Sem texto na busca (`q`), o cliente envia `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng` e a API filtra no banco; limite configurável (`MAP_POINTS_BBOX_ROW_LIMIT`, `MAP_POINTS_BBOX_OUT_CAP`).
- **Busca global** — Com `q` com 2+ caracteres, a API **não** aplica bbox (até 500 pontos relevantes em qualquer região).
- **Lojas** — `StoreMarkers` já carrega só lojas na área visível (`/api/map/stores` + bounds).

### Recomendações operacionais

- Manter **TTL** agressivo para usuário (24h) e **maior só para promo** importada.
- **Filtros na UI** (próximo passo opcional): rede, categoria, “só promoções”.
- **Índices Supabase** em `(lat, lng)` ou PostGIS se o volume crescer muito.

## “Tempo real”

- Realtime Supabase em `price_points` já existe no fluxo Mapbox (`PriceMap.js`).
- No mapa Leaflet (`/mapa`): refetch ao **mover o mapa** (debounce), botão **Atualizar preços** e **polling ~50s** só quando a aba está **visível** (`document.visibilityState`).

## Supervisor (bot de verificação)

Script **`scripts/mapa-supervisor.mjs`** — não melhora latência do usuário; só **testa** se produção responde e falha com exit code 1 se algo quebrar (útil para alertas).

```bash
npm run mapa-supervisor
MAP_SUPERVISOR_BASE_URL=https://finmemory.com.br node scripts/mapa-supervisor.mjs
node scripts/mapa-supervisor.mjs --base=https://finmemory.com.br --strict-config
```

Verifica: `GET /api/health`, `GET /api/map/points` (bbox SP), `GET /api/map/stores` (mesmo bbox). Saída em JSON.

**Cron (exemplo, a cada 15 min):**

`*/15 * * * * cd /caminho/Finmemory && MAP_SUPERVISOR_BASE_URL=https://finmemory.com.br node scripts/mapa-supervisor.mjs >> /var/log/finmemory-mapa-supervisor.log 2>&1`

No GCP: **Cloud Scheduler** → HTTP ou Job que rode o script (ou chame um endpoint seu que encapsule as mesmas checagens).

### Performance × supervisor

| O que sobe performance percebida | O que o supervisor faz |
|----------------------------------|-------------------------|
| Bbox na API, agrupamento de pins, índice SQL, filtro “Só promo”, polling só com aba visível | Garante que **serviços não estejam caídos** e que as APIs do mapa **respondam** |
