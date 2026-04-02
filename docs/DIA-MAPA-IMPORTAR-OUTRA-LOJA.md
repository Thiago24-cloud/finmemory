# FinMemory — Importar promoções de **outra loja DIA** no mapa

Este é o fluxo oficial para repetir o que foi feito em Pinheiros (Fradique Coutinho) em **qualquer outra URL** de loja no site do DIA.

## O que o sistema faz (resumo)

1. **Endpoint** `POST /api/scrapers/import-dia-offers` baixa o HTML da página da loja, transforma em texto e usa **GPT-4o-mini** para extrair `store_name` + lista de ofertas (`product_name`, `promo_price`, `valid_until`).
2. Grava em **`public.price_points`** com `category = 'Supermercado - Promoção'`, `lat`/`lng` (do body ou geocoding) e `user_id` do bot (`DIA_BOT_USER_ID` ou placeholder).
3. Remove antes, nas últimas **24h**, promoções duplicadas da mesma `store_name` (categoria com “promo”).
4. O mapa (`GET /api/map/points`) só mostra pontos com **TTL 24h**; lojas laranjas usam `GET /api/map/stores` + `price_points` promocionais recentes.

**Código:** `pages/api/scrapers/import-dia-offers.js`  
**Mapa (pins):** `components/MapaPrecosLeaflet.js` (agrupamento + bolha com número).

### Agente `finmemory-agent` (tabloides via `page-data.json`)

- `node finmemory-agent/agent.js --only=dia` lê `https://www.dia.com.br/page-data/lojas/<slug>/page-data.json` e grava **encartes** em `promocoes_supermercados` (`imagem_url`, `preco` muitas vezes **NULL**).
- No Supabase, **`preco` / `price` não podem ser NOT NULL** — senão o insert falha e o mapa fica vazio. Migração: `supabase/migrations/20260329180000_promocoes_preco_nullable.sql` ou copiar/colar `docs/SQL-PROMOCOES-PRECO-NULLABLE.sql`.
- Para as promoções caírem **no mesmo sítio do pin** no mapa, preencha **`stores.promo_page_url`** com a URL exata da loja (`https://www.dia.com.br/lojas/...`). O agente usa isso para **sobrescrever lat/lng** do JSON do Dia pelas coordenadas da tabela `stores`.
- **Capital SP completa (lista do site):** por defeito o agente lê `page-data/lojas-sp-capital/page-data.json` e **só** inclui slugs `sp-sao-paulo-*` (~**121** lojas no município; o JSON traz mais nós de outras cidades, que são ignorados). `DIA_MAX_STORE_PAGES` por defeito é **250**, por isso **um único job** cobre todas as lojas da capital.
- **Correr em produção (gravar no Supabase):** na raiz do repositório, `npm run promo:dia` (equivale a `node finmemory-agent/agent.js --only=dia`). O primeiro ciclo completo são **~121 pedidos** ao `page-data` de cada loja, em série, com pequena pausa entre lojas — prevê **vários minutos** e define o **timeout do Cloud Run Job** (ou do cron) com folga, por exemplo **≥ 3600 s** ou **5400 s** se quiseres margem para retries e latência.
- Para voltar a incluir todos os nós do JSON (não só SP capital): `DIA_REGION_INCLUDE_ALL_NODES=1`.

---

## Pré-requisitos no Cloud Run

No serviço **finmemory**, conferir:

| Variável | Motivo |
|----------|--------|
| `OPENAI_API_KEY` | Extração das ofertas na página |
| `SUPABASE_SERVICE_ROLE_KEY` | Insert/delete em `price_points` |
| `NEXT_PUBLIC_SUPABASE_URL` | Client Supabase |
| `DIA_IMPORT_SECRET` | (Opcional) Se definido, o POST precisa do mesmo segredo |
| `DIA_BOT_USER_ID` | (Opcional) UUID do “usuário bot” nos registros |

Se `DIA_IMPORT_SECRET` estiver definido, enviar o segredo em **`X-Cron-Secret`** ou **`?secret=`**.

Geocoding (Mapbox) usa a env do projeto em `lib/geocode.js` — manter token válido se **não** enviar `lat`/`lng` no body.

---

## Passo 1 — URL da loja

Usar a página pública da loja no DIA, no formato:

`https://dia.com.br/lojas/<estado>-<cidade>-<bairro-rua-numero>/`

Exemplo (Pinheiros):

`https://dia.com.br/lojas/sp-sao-paulo-pinheiros-rua-fradique-coutinho-1256/`

---

## Passo 2 — Chamar a API (produção)

Substitua `SUA_SECRET` se usar `DIA_IMPORT_SECRET`; caso contrário, pode omitir o header.

### PowerShell

```powershell
$headers = @{ "Content-Type" = "application/json" }
if ($env:DIA_IMPORT_SECRET) { $headers["X-Cron-Secret"] = $env:DIA_IMPORT_SECRET }

$body = @{
  storeUrl = "https://dia.com.br/lojas/SEU-CAMINHO-AQUI/"
  lat      = -23.5647   # opcional mas recomendado: coords exatas da loja
  lng      = -46.6891
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://finmemory-836908221936.southamerica-east1.run.app/api/scrapers/import-dia-offers" `
  -Headers $headers `
  -Body $body
```

**Recomendação:** pegar `lat`/`lng` no Google Maps (ou da tabela `public.stores`) para coincidir com o pin da loja e evitar geocoding genérico.

---

## Passo 3 — Alinhar com `public.stores` (pin laranja + lista no popup)

O pin **laranja** e o texto **“Ofertas ativas”** dependem de associar `price_points` à linha certa em `stores` (nome igual ou distância ≤ ~600 m — ver `pages/api/map/stores.js`).

Se o GPT gravar `store_name` diferente do `stores.name` (ex.: `"DIA"` vs `"DIA Supermercado"`), o mapa pode mostrar ofertas nos dados mas **não** no popup da loja certa.

**Correção típica (SQL no Supabase):** atualizar `price_points.store_name` (e se preciso `lat`/`lng`) para bater com `stores.name` e coordenadas da loja:

```sql
-- Ajuste nomes e coords conforme a linha real em public.stores
update public.price_points
set
  store_name = 'DIA Supermercado',
  lat = -23.5632904,
  lng = -46.6872222
where store_name ilike '%dia%'
  and category ilike '%promo%'
  and created_at >= now() - interval '24 hours';
```

(Valores são **exemplo**; sempre confirmar o registro correto em `stores`.)

---

## Passo 4 — Conferir no app

1. Abrir `/mapa`, **Ctrl+F5**.
2. Buscar pela loja ou produto; pins de preço são **bolhas** (com número se agrupados).
3. Toque no pin da loja (laranja se houver oferta) para ver contagem/lista resumida.

---

## Import manual (sem bot)

Inserir linhas em `price_points` com:

- `category`: `Supermercado - Promoção`
- `lat` / `lng`: iguais à loja em `stores`
- `store_name`: **igual** a `stores.name`
- `created_at`: dentro das últimas 24h para aparecer no mapa

---

## Problemas frequentes

| Sintoma | Causa provável |
|---------|-----------------|
| 403 no POST | `DIA_IMPORT_SECRET` errado ou ausente no header/query |
| `OPENAI_API_KEY não configurada` | Env ausente no Cloud Run |
| Ofertas no painel mas não no mapa | TTL 24h expirado; ou busca no topo filtrando (código atual carrega todos e filtra no cliente — após deploy recente) |
| Pin laranja mas lista vazia | `store_name` dos `price_points` ≠ `stores.name` ou coords muito longe |
| Poucas ofertas extraídas | HTML da página mudou; revisar prompt/modelo em `import-dia-offers.js` |

---

## Deploy

Alterações no scraper ou no mapa exigem novo build:

```powershell
.\deploy-cloud-run.ps1
```

---

*Última atualização: playbook interno FinMemory — fluxo DIA / mapa de preços.*
