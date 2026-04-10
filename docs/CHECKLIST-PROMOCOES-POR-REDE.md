# Checklist — priorizar redes e divulgar promoções no mapa

**Pedir ao bot (Cursor):** cola o prompt em `docs/PROMPT-BOT-CHECKLIST-PROMOCOES.md` ou ativa a regra **promo-map-checklist** nas regras do projeto (`.cursor/rules/promo-map-checklist.mdc`).

Este documento fecha o ciclo: **priorizar 2–3 redes com mais lojas**, **conferir nomes no Supabase**, **rodar o agente ou import DIA**, **validar no `/mapa`** com filtro **Só promo**.

## 1) Prioridade sugerida (3 níveis)

| Nível | Redes | Por quê |
|-------|--------|--------|
| **P1 — nacional / fan-out** | **Atacadão**, **Assaí**, **Carrefour** | Alto volume de `stores`, já em `FANOUT_CHAINS` no `finmemory-agent/agent.js`; uma execução do agente replica ofertas por loja cadastrada. |
| **P2 — grande varejo + DIA** | **Pão de Açúcar**, **DIA** | Pão de Açúcar no agente; DIA usa `POST /api/scrapers/import-dia-offers` + `promo_page_url` por loja (ver `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md`). |
| **P3 — regional / nicho** | **Sonda**, **São Jorge**, **Hirota**, **Lopes**, **Mambo**, **Ágape**, **Armazém do Campo** | Scrapers no agente; **Sonda** usa `sondadelivery.com.br` (HTML com preço; fan-out como P1). Ver `docs/TABLOIDES-FONTES-REDES-SP.md`. |

Comece por **P1** se o SQL abaixo mostrar muitas lojas nessas marcas na sua base.

## 2) SQL no Supabase (volume e cobertura)

Execute no **SQL Editor** o ficheiro:

- `docs/SQL-PRIORIZAR-REDES-PROMOCOES.sql`

Resumo do que ele faz:

1. Conta lojas por rede (heurística pelo **nome**).
2. Repete com filtro opcional **Grande SP** (ajuste `city`/`neighborhood` se o teu cadastro usar outro formato).
3. Lista atividade recente em `promocoes_supermercados`.
4. Lista `price_points` promocionais nas últimas 24 h.

**Correção de dados:** se uma rede tiver muitas lojas mas **0** promo no mapa, quase sempre é **nome** ou **coordenadas** que não batem com o que o job grava — alinha com `CHAIN_STORE_ALIASES` em `finmemory-agent/agent.js` e com `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md` para DIA.

## 3) Comandos do agente (raiz do repositório)

Pré-requisitos: `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no `.env` (ou `finmemory-agent/.env`), Playwright instalado (`npm install` em `finmemory-agent`).

| Objetivo | Comando |
|----------|---------|
| **P1 — Atacadão + Assaí + Carrefour** | `npm run promo:p1` |
| **P2 — Pão de Açúcar + Hirota** | `npm run promo:p2` |
| **DIA só** | `npm run promo:dia` |
| **P3 — regional (Sonda, São Jorge, Mambo, Ágape, Armazém do Campo)** | `npm run promo:regional` |
| **Sonda só** | `cd finmemory-agent && npm run sonda` |
| Tudo (cuidado: demora) | `npm run promo:agent` |
| Não grava na base (teste) | `npm run promo:agent:dry` |
| Uma rede | `cd finmemory-agent && node agent.js --only=carrefour` |

## 4) Import DIA (por loja)

1. Garante linha em `public.stores` com **nome** e **lat/lng** iguais ao pin.
2. Opcional: `promo_page_url` = URL da loja em `dia.com.br/lojas/...`.
3. `POST /api/scrapers/import-dia-offers` com `storeUrl` e, de preferência, `lat` / `lng` — ver regra do projeto em `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md` e segredo `DIA_IMPORT_SECRET` se existir.

## 5) Validação no app (produção ou local)

1. Abre **`/mapa`** autenticado (fluxo atual do produto).
2. Mantém **“Só promo”** ligado (checkbox no header).
3. Confirma **pins laranja** nas redes que corriste e popup da loja com “Ofertas ativas” / produtos.
4. Se o pin continua verde: confere **SQL** (secção 4 do `.sql`) e **logs** do agente; ajusta **nome da loja** em `stores` ou espera próximo run com fan-out.

## 6) Definição de “pronto” por rede

- [ ] Loja(s) em `stores` com coordenadas corretas e nome alinhado ao alias da rede.
- [ ] Job ou import testado (`--dry-run` primeiro, depois gravação).
- [ ] Produção: `npm run deploy:promo-agent-all` + `npm run promo:scheduler:setup` (todas as redes em `SCRAPERS`) — ver `docs/PROMO-AGENDAMENTO-PRODUCAO.md`.
- [ ] (Alternativa local/VM) Cron com `promo:p1` / `promo:dia` / rede específica.
- [ ] Validação visual no `/mapa` com **Só promo**.

## Ver também

- `docs/MAPA-PRECOS-PROMOCOES-ESTRATEGIA.md` — estratégia completa e tabela de URLs dos scrapers.
- `docs/SUPABASE-COPIAR-COLAR-MAPA-PROMOCOES.sql` — schema e índices.
- **Curadoria manual (folheto / Instagram capturado):** Sacolão São Jorge — `docs/SACOLAO-SAO-JORGE-MAPA-CURADORIA.md` (JSON → `generate-curadoria-promocoes-sql.mjs`, Supabase só recebe o SQL gerado).
