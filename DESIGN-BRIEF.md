# FinMemory — Design brief para o mapa de preços (Lovable / design)

Documento para **sincronizar o repositório com o Lovable** e orientar melhorias de UI/UX, com foco no **mapa de preços** (`/mapa`) e no público que precisa de **orientação rápida** (ex.: menos cliques, menos pins genéricos).

---

## 1. Onde está o código hoje

| Área | Ficheiros principais |
|------|----------------------|
| Página do mapa | `pages/mapa.js` |
| Mapa Leaflet (pins, lojas, preços) | `components/MapaPrecosLeaflet.js` |
| Wrapper / props | `components/MapaPrecos.js` |
| Cores por categoria e temas de mapa | `lib/colors.js` |
| API lojas (bbox) | `pages/api/map/stores.js` |
| API pontos de preço + promoções agente | `pages/api/map/points.js` |

**Stack:** Next.js (Pages Router), Leaflet, `divIcon` para pins customizados.

**Restrições:** Manter as rotas `/api/map/stores` e `/api/map/points`; não quebrar o fluxo de login existente.

---

## 2. Público e objetivo

- **Público:** Incluir pessoas com **menos familiaridade com mapas** (ex.: 60+), que não devem precisar de **abrir cada empresa** para perceber o que está à volta.
- **Objetivo da tela:** Ver **de relance** (1) onde estão, (2) onde há **lojas**, (3) onde há **ofertas/promoções**, (4) **preços partilhados** — com **legenda clara** e **pins distinguíveis**.

---

## 3. Problema atual (para o design atacar)

- Pins de **loja** são sobretudo **círculos verdes** com ícone pequeno por **tipo** (supermercado, farmácia, padaria): **várias redes parecem iguais**.
- Pins de **preço** são **bolas por categoria**: muitas cores → sensação de “tudo igual / confuso”.
- **Ofertas** destacam-se com **laranja** quando `tem_oferta_hoje`; o resto do tempo **redes diferentes** continuam visualmente parecidas.

**Direção:** Introduzir **identidade por rede** (cor da marca, monograma ou forma) **além** do tipo de estabelecimento.

---

## 4. Requisitos de UX (priorizados)

### Fase A — Alto impacto, base para idosos / auto-localização

1. **“Onde estou eu”**  
   - Marcador de **geolocalização** grande, alto contraste, fácil de ver (ex.: estilo “ponto azul + anel”).  
   - Ao abrir o mapa, se o utilizador autorizar: **centrar** e **zoom** num raio legível (ex.: 1–2 km).  
   - Texto curto no topo: *“A mostrar a zona à tua volta”* (ou equivalente em PT-BR).

2. **Botão “Voltar para mim”**  
   - Sempre visível (FAB ou canto fixo), para **recentrar** após arrastar o mapa.

3. **Legenda fixa**  
   - **Sempre visível** (não só atrás de ícone): ex. *Laranja = ofertas hoje*, *Verde = loja*, *Bola = preço partilhado*.  
   - **Ícones grandes** + texto **≥ 16 px**, contraste **WCAG** quando possível.

### Fase B — Menos cliques, mais contexto

4. **Resumo da área visível**  
   - Uma linha (topo ou rodapé do mapa): ex. *“Nesta zona: X lojas, Y com oferta, Z preços”* (valores vindos dos dados já carregados ou contagem aproximada).

5. **Filtros em chips grandes**  
   - Manter/melhorar **“Só promo”**.  
   - Ideal: filtros por **rede** (Dia, Carrefour, Atacadão, …) quando `store_name` ou metadados permitirem — **reduz pins** sem explorar um a um.

### Fase C — Pins menos genéricos

6. **Dupla codificação**  
   - Não depender só da **cor**: usar **forma** distinta para promo (ex.: estrela, %, losango).

7. **Rede / marca na loja**  
   - Heurística por nome (`store.name` ou `store_name`): **cor do anel** ou **monograma** (“DIA”, “CF”, …) legível **sem zoom máximo**.

8. **Etiqueta curta (opcional, zoom alto)**  
   - Nome abreviado ou iniciais **sob** ou **ao lado** do pin, para não depender só do popup.

### Fase D — Acessibilidade e modo calmo

9. **Toque**  
   - Áreas clicáveis **≥ 44×44 px**; popup com **fechar** óbvio e grande.

10. **Daltonismo**  
    - Não usar **só** vermelho/verde para estados críticos; combinar com ícone/forma.

11. **Modo “Mapa simples” (opcional)**  
    - Toggle: menos camadas (ex.: só lojas + promo), zoom inicial mais próximo, menos ruído visual.

---

## 5. Tokens e consistência

- Centralizar ou alinhar com **`lib/colors.js`** (`CATEGORY_COLORS`, `MAP_THEMES`) ou substituir por **tokens nomeados** (ex.: `--map-promo`, `--map-store`, `--map-user`) num único sítio.  
- Definir **tipografia mínima** para legendas e filtros no mapa.

---

## 6. Prompt sugerido para colar no Lovable

> Redesenhar o mapa de preços (Leaflet em `components/MapaPrecosLeaflet.js` e página `pages/mapa.js`) para:  
> (1) marcador **“minha posição”** muito visível + **centrar na zona** ao abrir com permissão de localização;  
> (2) botão fixo **“Voltar para mim”**;  
> (3) **legenda sempre visível** com ícones grandes e texto ≥16px;  
> (4) pins de **loja** diferenciados por **rede** (cor ou monograma) além do tipo (farmácia/padaria);  
> (5) **ofertas** com forma distinta (ex. estrela ou %);  
> (6) **resumo** da área visível (contagens);  
> (7) **filtros grandes** (“Só promo” e, se possível, por rede);  
> (8) respeitar ou refactorizar `lib/colors.js` para tokens;  
> (9) **não quebrar** `/api/map/stores` nem `/api/map/points`.  
> Público-alvo: quem precisa de **orientação imediata** no mapa **sem** abrir dezenas de popups.

---

## 7. Checklist pós-implementação

- [ ] Legenda legível em telemóvel (largura pequena).  
- [ ] Localização + recentrar testados em Chrome/Safari (permissões).  
- [ ] Com “Só promo” ativo, pins e legenda ainda fazem sentido.  
- [ ] Contraste texto/fundo na legenda e nos chips de filtro.  
- [ ] Nenhuma regressão nas chamadas às APIs do mapa.

---

## 8. Notas para sync com Lovable

- Ligar o **repositório Git** (branch `main`) ao projeto Lovable.  
- Manter este ficheiro **`DESIGN-BRIEF.md`** na raiz para o fluxo de design/IA ler o mesmo contexto.  
- Opcional: acrescentar screenshots em `docs/design/` e referenciar aqui os ficheiros.

---

*Última atualização: alinhado ao estado do mapa em `MapaPrecosLeaflet.js` e `lib/colors.js`.*
