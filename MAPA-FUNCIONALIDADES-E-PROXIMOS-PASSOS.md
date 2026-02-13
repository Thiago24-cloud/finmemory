# Mapa de Preços – O que já existe e próximos passos

## O que já está no código

### Pins (marcadores)
- **Preços:** marcadores customizados (quadrado com $, cor por categoria) a partir da tabela `price_points`.
- **Perguntas da comunidade:** pins com “?” a partir de `map_questions`.
- **Cores por tipo:** supermercado, farmácia, posto, etc. em `PriceMap.js` (`LOCATION_COLORS`).
- **Popup:** ao clicar no pin, mostra loja, produto, preço e “há X min”.
- **API:** `GET /api/map/points` (até 500 pontos) e Realtime do Supabase para novos pins sem recarregar.

### Localização
- **Geolocalização do usuário:** `navigator.geolocation.getCurrentPosition` no modal de pergunta (mapa) e em “Compartilhar preço” (`share-price.js`).
- **Geocoding (endereço → lat/lng):** `lib/geocode.js` – `geocodeAddress(query)` usando Mapbox Geocoding API (ex.: “Drogasil, São Paulo”).
- **Uso do geocoding:** ao salvar transação via OCR (`api/ocr/save-transaction.js`) para criar `price_points` com coordenadas.
- **Auto price points:** `lib/autoPricePoints.js` usa a posição atual para criar pontos a partir de transações.

### Infra
- Mapbox GL JS, estilos (claro, ruas, escuro, satélite).
- Supabase: `price_points`, `map_questions`, Realtime.
- Token Mapbox em `.env.local` / Cloud Run.

---

## O que pode ser adicionado (mais código / outras ferramentas)

### 1. Clustering de pins
**Problema:** Muitos pins no mesmo lugar poluem o mapa.  
**Solução:** Agrupar pins próximos em um único marcador com número (ex.: “12”) e ao dar zoom ou clicar expandir.

**Ferramenta sugerida:** `supercluster` (ou `react-map-gl` com clustering).

```bash
npm install supercluster
```

- Criar um layer de clusters no Mapbox (ou marcadores que representam clusters).
- Fonte de dados: array de pontos com `{ lat, lng, ... }`.
- Ao clicar no cluster: dar zoom ou listar os pontos num popup.

### 2. Reverse geocoding (lat/lng → endereço)
**Uso:** Mostrar “Você está em: Rua X, Bairro Y” ou pré-preencher endereço ao compartilhar preço.

**Opção A – Mapbox (já tem token):**  
`GET https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json?access_token=...`

- Criar em `lib/geocode.js` algo como `reverseGeocode(lat, lng)` e usar onde precisar (mapa, share-price, etc.).

**Opção B:** Nominatim (OpenStreetMap), gratuito, sem token.

### 3. Busca / autocomplete de endereços
**Uso:** Campo “Buscar endereço ou estabelecimento” que sugere lugares e centraliza o mapa.

**Ferramenta:** Mapbox Geocoding API com `limit=5` e debounce no input.

- Endpoint: `.../mapbox.places/{query}.json?country=BR&limit=5`.
- Ao selecionar um resultado: `map.flyTo({ center: [lng, lat], zoom: 15 })`.
- Pode reutilizar `geocodeAddress` e criar `searchPlaces(query)` que devolve lista de features.

### 4. Botão “Minha localização” no mapa
**O que já existe:** Só dentro do modal de pergunta.  
**Melhoria:** Botão fixo no canto do mapa (ícone de alvo) que:
- Chama `navigator.geolocation.getCurrentPosition`.
- Centraliza o mapa com `map.flyTo({ center: [lng, lat], zoom: 14 })`.
- Opcional: desenhar um marcador “você está aqui” (círculo ou pin).

Requer apenas lógica em `PriceMap.js` + um botão na UI do mapa.

### 5. Tratamento de permissão de localização
**Problema:** Usuário nega ou o navegador bloqueia; hoje pode só dar erro genérico.

**Melhorias:**
- Verificar antes: `navigator.permissions?.query({ name: 'geolocation' })`.
- Mensagens claras: “Ative a localização no navegador” / “Permita acesso à localização”.
- Fallback: seguir com fluxo sem coordenadas (ex.: não pré-preencher “minha localização”) ou pedir endereço manual.

### 6. Rotas / direções (opcional)
**Uso:** “Como chegar” do usuário até um estabelecimento.

**Ferramenta:** Mapbox Directions API (ou Mapbox Navigation).  
- Requer chamada HTTP server-side ou com token restrito a domínio.
- Mostrar polyline da rota no mapa e/ou lista de passos.

### 7. Filtros no mapa
**Ideia:** Filtro por categoria (supermercado, farmácia), por período (últimos 7 dias) ou por raio (ex.: 5 km de mim).

- **Código:** Os pontos já vêm de `/api/map/points`; dá para acrescentar query params: `?category=supermercado&days=7`.
- **Raio:** filtrar no front com distância (fórmula Haversine) ou no backend com PostGIS/Supabase (extensão `postgis` e filtro por distância).

### 8. PWA / cache do mapa (opcional)
Para funcionar melhor offline ou em rede lenta:
- Service Worker (ex.: `next-pwa` ou Workbox).
- Cache de tiles do Mapbox conforme termos de uso.

---

## Resumo prático

| Funcionalidade           | Já existe? | Próximo passo (ferramenta / código)        |
|--------------------------|-----------|---------------------------------------------|
| Pins de preço e perguntas| Sim       | Clustering com `supercluster`               |
| Minha localização (modal)| Sim       | Botão “Minha localização” fixo no mapa     |
| Endereço → coordenadas   | Sim       | Reverse geocode em `lib/geocode.js`        |
| Busca de lugar           | Não       | Mapbox Geocoding + debounce no input        |
| Permissão de localização | Parcial   | `navigator.permissions` + mensagens claras  |
| Filtros (categoria, tempo)| Parcial  | Query params em `/api/map/points` + UI      |
| Rotas                    | Não       | Mapbox Directions API (se quiser)          |

Se quiser, posso sugerir o código concreto para o próximo item que você quiser implementar (ex.: clustering, botão “minha localização” ou reverse geocode).
