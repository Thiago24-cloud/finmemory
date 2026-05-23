# Enriquecimento de imagens sob demanda (Cosmos → R2)

## Onde está instalado

| Peça | Caminho |
|------|---------|
| Lógica principal | `lib/catalog/processImageSync.js` |
| Cache / URLs R2 | `lib/catalog/catalogImageUrls.js` |
| Cosmos (GTIN + busca por nome) | `lib/catalog/cosmosProductImageLookup.js` |
| Upload R2 | `lib/catalog/ingestRemoteImageToR2.js` |
| Fila bot | `lib/catalog/enrichBotFilaImages.js` |
| **Mapa (`price_points`)** | `lib/catalog/enrichPricePointsImages.js` |
| Hook pós-insert mapa | `lib/catalog/afterMapPricePointsInsert.js` |
| Disparo async | `lib/catalog/triggerImageEnrichment.js` |
| API batch | `pages/api/catalog/enrich-product-images.js` |
| API teste 1 produto | `pages/api/catalog/process-image-sync.js` |
| Scrapers DIA / Atacadão | `lib/diaScraper/scraperDiaCore.js`, `lib/atacadaoScraper/scraperAtacadaoCore.js` |
| Aprovação fila | `pages/api/admin/bot-fila.js` |
| Fila de ingestão | `lib/ingest/enqueuePromocoes.js` |
| Migrações | `20260527130000_promocoes_tentativa_busca_imagem.sql`, `20260527140000_price_points_tentativa_busca_imagem.sql` |

## Fluxo (padrão único)

1. Produto **sem** imagem R2 (`finmemory.com.br/catalog-products/...`) e **sem** `tentativa_busca` → tenta resolver.
2. **Cache** (`map_product_image_cache`) — se já temos URL R2, reutiliza (suavidade para produtos repetidos).
3. **URL externa** (scraper/CDN) → download → R2 → cache.
4. **Cosmos** (GTIN ou nome limpo) → download → **obrigatório R2** → grava em Supabase + cache.
5. Falha → `tentativa_busca_imagem: true` em `promocoes_supermercados` ou `price_points` (não fica em loop).

Publicação no mapa **não espera** a imagem: scrapers e aprovação disparam enriquecimento em background.

## Variáveis

- `COSMOS_API_TOKEN` — Cosmos Bluesoft
- `CLOUDFLARE_R2_*` — repositório canónico de imagens
- `CATALOG_ENRICH_SECRET` ou `CRON_SECRET` — APIs e script CLI
- `NEXT_PUBLIC_APP_URL` — disparo async em produção

## Teste manual

### Um produto

```bash
curl -X POST "http://localhost:3000/api/catalog/process-image-sync" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: SEU_SECRET" \
  -d "{\"product\":{\"nome\":\"Açúcar Refinado União 1kg\",\"gtin\":\"7891910000197\"}}"
```

### Lote promoções ativas

```bash
npm run catalog:enrich-images
```

### Lote pontos do mapa (últimos 7 dias, sem imagem R2)

```bash
node -r dotenv/config scripts/enrich-product-images.mjs --mode=price_points --days=7 --limit=60
```

### Via HTTP (cron diário recomendado)

```bash
curl -X POST "https://finmemory.com.br/api/catalog/enrich-product-images" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: SEU_SECRET" \
  -d "{\"mode\":\"price_points\",\"days\":7,\"limit\":80,\"async\":true}"
```

Modos: `promocoes` | `price_points` | `bot_fila` (com `filaId`).

Resposta `async: true` devolve **202** imediatamente (scrapers, fila, cron).

## SQL (Supabase)

Executar as duas migrações de `tentativa_busca_imagem` no projeto Supabase.
