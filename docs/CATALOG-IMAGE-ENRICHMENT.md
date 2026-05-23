# Enriquecimento de imagens sob demanda (Cosmos → R2)

## Onde está instalado

| Peça | Caminho |
|------|---------|
| Lógica principal | `lib/catalog/processImageSync.js` |
| Cosmos (GTIN + busca por nome) | `lib/catalog/cosmosProductImageLookup.js` |
| Upload R2 | `lib/catalog/ingestRemoteImageToR2.js` |
| Fila bot | `lib/catalog/enrichBotFilaImages.js` |
| Disparo async | `lib/catalog/triggerImageEnrichment.js` |
| API batch | `pages/api/catalog/enrich-product-images.js` |
| API teste 1 produto | `pages/api/catalog/process-image-sync.js` |
| Fila de aprovação | `lib/ingest/enqueuePromocoes.js` + `pages/api/admin/bot-fila.js` |
| Separação ready/pending | `lib/promoQueueProcessing.js` |
| Migração flag | `supabase/migrations/20260527130000_promocoes_tentativa_busca_imagem.sql` |

## Fluxo

1. Produto **sem** `imagem_url` / `image_url` e **sem** `tentativa_busca` → consulta Cosmos (GTIN ou nome).
2. Imagem encontrada → download → `uploadToR2` em `catalog-products/...` → grava URL no Supabase + `map_product_image_cache`.
3. Não encontrada → `tentativa_busca: true` (JSON na fila) ou `tentativa_busca_imagem` em `promocoes_supermercados`.

Publicação no mapa (`price_points`) **não espera** a imagem: o enriquecimento corre em background.

## Variáveis

- `COSMOS_API_TOKEN` — obrigatório para Cosmos
- `CLOUDFLARE_R2_*` — upload (fallback: URL CDN Cosmos se R2 falhar)
- `CATALOG_ENRICH_SECRET` ou `CRON_SECRET` — APIs e script CLI
- `NEXT_PUBLIC_APP_URL` — URL para disparo async em produção

## Teste manual

### Um produto

```bash
curl -X POST "http://localhost:3000/api/catalog/process-image-sync" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: SEU_SECRET" \
  -d "{\"product\":{\"nome\":\"Açúcar Refinado União 1kg\",\"gtin\":\"7891910000197\"}}"
```

### Lote (promoções ativas sem imagem)

```bash
npm run catalog:enrich-images
# ou com limite
node -r dotenv/config scripts/enrich-product-images.mjs --limit=15
```

### Fila bot específica

```bash
node -r dotenv/config scripts/enrich-product-images.mjs --fila-id=UUID_DA_FILA
```

### Via HTTP

```bash
curl -X POST "https://finmemory.com.br/api/catalog/enrich-product-images" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: SEU_SECRET" \
  -d "{\"mode\":\"promocoes\",\"limit\":30}"
```

Resposta `async: true` devolve **202** imediatamente (usado após `enqueuePromocoes` e aprovação parcial na bot-fila).

## SQL (Supabase)

Executar a migração `20260527130000_promocoes_tentativa_busca_imagem.sql` no projeto Supabase.
