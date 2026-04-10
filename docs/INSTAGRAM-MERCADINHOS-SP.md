# Instagram — mercados, mercadinhos e promoções em SP (feed, stories e FinMemory)

Referência operacional quando a rede **só divulga no Instagram** (ou parte da oferta está **só nos stories**), como no caso citado de **Pomar da Vila** na região **Morato Coelho** (São Paulo).

## Por que o app não “pega” stories nem o feed automaticamente

| O que o usuário vê | O que o código faz hoje |
|------------------------|-------------------------|
| **finmemory-agent** (`finmemory-agent/agent.js`) | Lê **sites** e **JSON públicos** das grandes redes (DIA, Assaí, Carrefour, etc.). **Não** chama Instagram nem Facebook. |
| **Stories** | Somem em ~24h, muitas vezes exigem **sessão logada**. A **API Graph do Instagram** só expõe stories de contas **comerciais ou de criador** que **você** conectou ao seu app na Meta — não dá para listar qualquer `@mercado` arbitrário como “robô anônimo”. |
| **Posts com foto de gôndola** | Endereços de mídia no IG costumam ser **instáveis** ou **inacessíveis** para servidores externos; usar `imageUrl` de CDN do IG em `POST /api/promotions/extract-flyer-vision` **falha** com frequência. |
| **Termos de uso / anti-robô** | Automatizar a coleta (scraping) de perfis de terceiros no IG vai contra as regras do Meta e costuma parar de funcionar. Por isso a estratégia do projeto continua: **site > API > link no post para encarte**; o IG como **última fonte**, com fluxo controlado (abaixo). |

Documento geral de prioridades: `docs/MAPA-PRECOS-PROMOCOES-ESTRATEGIA.md`.

## Fluxo acordado: lista de perfis + feed que **tu** vês + captura → FinMemory

Muitos mercados **não** vão marcar o @ do FinMemory no início; o conteúdo **aparece no teu feed** porque **segues** essas contas. Esse fluxo funciona assim — com um ponto importante:

| Quem | O quê |
|------|--------|
| **Tu (ou curador)** | Segues só os `@` da **lista**; vês posts/stories **na app do Instagram**; quando for um mercado da lista com promo legível, **tiras captura** (ou exportas a imagem). |
| **FinMemory (servidor)** | **Não** lê o teu feed do Instagram automaticamente. Só entra em ação quando recebe **imagem** (idealmente `imageBase64`) + `supermercado` + `geocodeQuery` ou `lat`/`lng`. |
| **`extract-flyer-vision`** | Lê **preços e produtos** a partir da **imagem** (o mesmo tipo de análise que já usamos para encartes e site). |
| **`public.stores`** | Geolocalização **estável** no mapa: preferir coordenadas da loja (Maps) ou geocodificar o texto da **bio** (rua, bairro) **com** “São Paulo, SP, Brasil” quando for capital/GRU; alinhar `nome_loja` ao que vai nas ofertas. |

**Lista branca:** só processar mentalmente (ou num script interno futuro) mercados que estão no ficheiro de curadoria — ver modelo em **`docs/instagram-curadoria-mercados-sp.example.json`**. Copia para um JSON teu (ex.: `instagram-curadoria-mercados-sp.json`, pode ficar fora do Git se quiseres) e vai preenchendo `instagram`, `supermercado` (slug), `nome_loja` e **`geocode_query`** copiado da bio (completar com cidade/estado).

**Sincronizar tudo no FinMemory (ordem sugerida):**

1. **Nova loja na lista** — regista `@`, slug `supermercado`, e o texto de endereço da bio em `geocode_query` (ex.: `"Rua X, 100, Bairro Y, São Paulo, SP, Brasil"`).
2. **`public.stores`** — cria ou atualiza linha com **nome** coerente com `nome_loja`, **lat/lng** (Google Maps na fachada ou geocoding a partir da bio).
3. **Quando sair post/story com preços** — captura → `POST /api/promotions/extract-flyer-vision` com:
   - `supermercado` = slug da lista;
   - `imageBase64` + `imageMimeType`;
   - `geocodeQuery` = o mesmo texto que usaste para a loja (ou `lat`/`lng` se já tiveres na lista/BD);
   - `flyerKey` = data ou id do post (evita duplicar a mesma corrida).

Assim **imagens, preços (na imagem)** e **geolocalização (bio + loja no mapa)** ficam alinhados ao que já fazes para **site e app** — sem o servidor “entrar” no perfil do Instagram; só **tu** vês o feed e **envias** o que interessa.

### Referência ativa — Pomar da Vila **só unidade Vila Madalena**

A cadeia tem várias lojas; por defeito, quando o utilizador manda **posts/capturas** para subir preços, trata-se **apenas desta unidade** até indicar outra filial.

| Campo | Valor |
|--------|--------|
| **Instagram** | `@pomardavila_vila_madalena` |
| **`supermercado` (slug no API)** | `pomardavilavilamadalena` — usar **sempre** este slug em `extract-flyer-vision`, nunca o genérico `pomardavila`, para não misturar filiais. |
| **Endereço (bio)** | Rua Mourato Coelho, 1458 — Vila Madalena, São Paulo, SP |
| **`geocodeQuery` sugerido** | `Rua Mourato Coelho, 1458, Vila Madalena, São Paulo, SP, Brasil` |
| **Coordenadas aprox.** | `lat` ≈ -23,5547, `lng` ≈ -46,6912 — **confirmar na fachada** no Maps ao criar `public.stores`. |

Lista editável: **`docs/instagram-curadoria-mercados-sp.example.json`** (primeira entrada).

**Lote consolidado (exemplo):** carrossel IG Pomar Vila Madalena (ofertas 04–09/04/2026) — **`data/curadoria/pomar-vila-madalena-ig-2026-04-04-a-09.json`** (`produtos` + `meta` com slug `pomardavilavilamadalena`). Serve de conferência ou base para importação; gravar no Supabase continua a ser via `extract-flyer-vision` ou job dedicado com `SUPABASE_SERVICE_ROLE_KEY`.

## Roteiro — colocar Pomar da Vila (e similares) no mapa

### 1) Loja em `public.stores`

Sem linha em **`stores`** (nome + **lat/lng** corretos, tipo supermercado), o mapa não associa bem oferta ↔ pin.

- Nome alinhado ao que vai aparecer nas promoções (ex.: “Pomar da Vila — Morato” ou o padrão que usarem no encarte).
- Coordenadas da fachada (Google Maps).
- Se existir **site com encarte fixo**, preencher `promo_page_url` e avaliar scraper tipo DIA / entrada no `SCRAPERS` do agente.

### 2) Promo só no feed ou story → visão (OCR) com imagem que o servidor consegue ler

**Endpoint:** **`POST /api/promotions/extract-flyer-vision`**

- **Imagem:** de preferência **`imageBase64`** + `imageMimeType` (captura de tela do post, do story ou um quadro de vídeo). Evitar `imageUrl` apontando para `instagram.com` ou CDNs restritos.
- **Corpo da requisição:** `supermercado` (identificador curto sem espaços, ex.: `pomardavila`), `storeName` ou `geocodeQuery` (ex.: endereço + “São Paulo”) se não enviar `lat`/`lng`, `flyerKey` opcional (ex.: `2026-04-05`) para não duplicar execuções.
- **Segredo:** se existir `ENCARTE_EXTRACT_SECRET` (ou variável reserva no código do handler), enviar o cabeçalho **`X-Cron-Secret`** (ou `?secret=` conforme o handler).

O modelo extrai produtos e preços como num encarte; os dados entram no fluxo de promoções com tempo de vida (TTL) configurável (`PROMO_TTL_HOURS` / `FINMEMORY_TTL_HOURS`).

### 3) Descoberta manual de outros mercados em SP (curadoria)

Na app do Instagram, pesquisas úteis (exemplos):

- **Palavras:** mercado, mercadinho, minimercado, hortifruti, sacolão, supermercado + nome do bairro.
- **Hashtags:** combinar #ofertas, #promocao, #saopaulo com bairro.

Para cada candidato interessante: repetir **passo 1**; se não houver site estável, **passo 2** quando sair post/story com preço legível.

### 4) Único caminho “automático” sério para feed + stories

**Parceria com o mercado:** eles autorizam o app da Meta na **própria** página comercial (Business), ou enviam **link fixo de tabloide**, **planilha** ou **WhatsApp com encarte**. Só assim dá para agendar uma tarefa agendada (job) sem captura de tela manual.

### 5) Conta Instagram **sua** conectada ao FinMemory (permissão explícita)

Faz sentido e é **mais alinhado com segurança e ética** do que “entrar” no perfil de terceiros sem API: **você** autoriza o app na **sua** conta (de preferência **Instagram Profissional** ligado a uma **Página** do Facebook), com login oficial da Meta (**OAuth**), tokens guardados no **servidor**, permissões mínimas e, quando necessário, **App Review**.

**O que isso permite na prática (APIs oficiais):**

- **Conteúdo e métricas da própria conta** (suas publicações, insights, etc.).
- **Mensagens automáticas** no estilo “resposta rápida” costumam usar o **Instagram Messaging API** — ou seja, quando alguém **manda mensagem para a página/conta do FinMemory**, o fluxo responde. Isso **não** é o mesmo que “varrer o Instagram procurando mercado”; é canal **entrante** para o **seu** inbox.

**O que a Meta não entrega de forma estável para integradores** (mesmo com a sua conta logada):

- Reproduzir a **barra de pesquisa** do app (“digitar mercado e listar todos os perfis”) como um endpoint público documentado para automação contínua. Quem faz isso costuma ser **automação de interface** (simular cliques), que **não** é o caminho suportado e pode violar os Termos.

**Híbrido realista com a sua ideia de curadoria:**

1. Manter uma **lista de @** de mercados (planilha ou banco) que **você** segue ou acompanha manualmente.
2. Quando aparecer post/story relevante, **você** (ou um fluxo semi-automático) envia **imagem** para `extract-flyer-vision` (base64), como no roteiro acima.
3. Se no futuro a Meta liberar escopos claros para **menções / parcerias** com marcas que **autorizam** o FinMemory, aí sim dá para endurecer a automação **sem** “hack”.

Resumo: **conectar a sua conta ao app é o caminho certo para permissão e segurança**; o limite hoje é **o que a API oficial permite ler**, não a vontade de dar permissão. Não confundir **bot de DM** (mensagens **para você**) com **robô de descoberta** no feed de terceiros — são produtos diferentes na plataforma.

## O que pedir ao assistente / robô (Cursor)

- **Não** prometer coleta em massa no IG de terceiros nem leitura automática de **todos** os stories de SP.
- **Não** dizer que o backend “vê o feed” só porque o utilizador segue os mercados — o fluxo suportado é **captura enviada** + lista em **`docs/instagram-curadoria-mercados-sp.example.json`** (ou equivalente).
- **Sim:** cadastrar `stores`, documentar `@` e `geocode_query` da bio, preparar chamada a **`extract-flyer-vision`** com **base64** quando o utilizador enviar uma captura, ou desenhar integração com a Meta **somente** no cenário de parceiro.
- Para grandes redes com site: usar **`docs/CHECKLIST-PROMOCOES-POR-REDE.md`** e o agente (`npm run promo:*`), não o Instagram.

## Exemplo mínimo (comando curl) — `extract-flyer-vision`

Ajuste a URL base, o segredo e um arquivo `foto.b64` (só o conteúdo em base64, sem o prefixo `data:`):

```bash
curl -sS -X POST "https://SEU_DOMINIO/api/promotions/extract-flyer-vision" ^
  -H "Content-Type: application/json" ^
  -H "X-Cron-Secret: SEU_SEGREDO" ^
  -d "{\"supermercado\":\"pomardavila\",\"imageMimeType\":\"image/jpeg\",\"imageBase64\":\"...\",\"geocodeQuery\":\"Pomar da Vila Morato Coelho Sao Paulo\",\"flyerKey\":\"2026-04-05\"}"
```

No PowerShell, monte o JSON com `ConvertTo-Json` e um arquivo para evitar erros de escape nas aspas.
