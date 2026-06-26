# FinMemory Retailer — Android (SmartPOS Stone)

App nativo para maquininha Stone com controle de estoque integrado ao backend `apps/retailer`.

## Requisitos

- Android API 23+ (SmartPOS Stone)
- Kotlin 2.0+, Koin 4.0+
- TLS 1.2+ (`network_security_config.xml`)
- `packageName`: `br.com.finmemory.retailer.painel` (sem "Stone" no nome)

## Estrutura principal

| Componente | Função |
|------------|--------|
| `SecureTokenStore` | Token de sessão em `EncryptedSharedPreferences` |
| `NetworkConnectivityRepository` | Estado online/offline (`StateFlow`) |
| `SaleSyncRepository` | POST `/api/merchant/vendas` com fila offline (Room) |
| `StonePaymentGateway` | Stub para SDK Stone (Fase 1) |

## Configuração local

1. Copie `local.properties.example` → `local.properties` (não commitar).
2. Ajuste `FINMEMORY_API_BASE_URL` para o host HTTPS do retailer (obrigatório Stone).
3. Para Stone SDK, adicione token PackageCloud e descomente o repositório em `settings.gradle.kts`.

```properties
sdk.dir=C\:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
FINMEMORY_API_BASE_URL=https://finmemory-retailer-836908221936.southamerica-east1.run.app
# Após DNS de parceiros.finmemory.com.br:
# FINMEMORY_API_BASE_URL=https://parceiros.finmemory.com.br
stonePackageCloudToken=SEU_TOKEN_STONE
```

## Build

```bash
cd apps/retailer-android
# Se ainda não tiver gradlew, copie de android/ na raiz do monorepo ou rode: gradle wrapper
./gradlew :app:assembleDebug
```

## Próximas fases

1. **Stone SDK** — dependência AAR, `StonePaymentGateway` real, meta-data no manifest
2. **Pagamento** — fluxo captura → callback → `SaleSyncRepository.submitSale`
3. **API** — criar `POST /api/merchant/vendas` no Next.js retailer (baixa `produtos_loja` / insumos)
4. **Catálogo na maquininha** — listagem de produtos com estoque

## Offline

Vendas sem rede são salvas em `pending_sales` (Room). Quando `NetworkConnectivityRepository` detecta rede validada, `SaleSyncRepository.flushPendingSales()` envia em ordem FIFO com `X-Idempotency-Key`.
