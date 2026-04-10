# FinMemory — Sacolão São Jorge no mapa (curadoria / folheto)

Fluxo **manual** para repetir o padrão usado com **Pomar da Vila** e outras curadorias: você separa os produtos do folheto (ou captura) num **JSON**, gera **SQL** na máquina e cola no **SQL Editor** do Supabase — **não** rode `node` dentro do Supabase.

Para redes com scraper automático, use `docs/CHECKLIST-PROMOCOES-POR-REDE.md` e `docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md` (DIA). Aqui o foco é **Sacolão / Grupo São Jorge** com **`supermercado_slug`: `saojorge`**.

---

## O que o sistema faz (resumo)

1. **`public.promocoes_supermercados`** — ofertas com `lat`/`lng` por unidade; o mapa agrupa com o pin da loja quando o nome e as coordenadas batem com `public.stores`. Gerado por `scripts/generate-curadoria-promocoes-sql.mjs`.
2. **`public.promotions`** — secção “Promoções (encarte)” no popup da loja (Vila Madalena como unidade de referência no script atual). Gerado por `scripts/generate-sacolao-promotions-table-sql.mjs`.
3. **Raio de match** — para o slug da rede, a API usa um raio maior (`MAP_STORE_OFFERS_CHAIN_SLUG_RADIUS_KM`, padrão **2,5 km**) para encaixar curadoria e pin; mesmo assim **alinhe** `stores.lat`/`stores.lng` com o JSON quando possível.

**Código de referência:** `pages/api/map/store-offers.js`, `pages/api/map/stores.js`, `lib/storeLogos.js` (`isSacolaoSaoJorgeCuratedStoreName`).

---

## Padrão do JSON de curadoria

Copie a estrutura de **`data/curadoria/sacolao-sao-jorge-operacao-abre-mes-2026-04.json`** (fonte de verdade para nomes de campos).

| Campo | Obrigatório | Notas |
|--------|-------------|--------|
| `meta.supermercado_slug` | sim | Use **`saojorge`** para bater com o alias da rede no mapa. |
| `meta.unidades[]` | sim | Cada unidade: `nome`, `lat`, `lng` (números). Replica cada produto por unidade no SQL de `promocoes_supermercados`. |
| `meta.run_id` | sim | Identificador estável do lote (ex.: `curadoria-sacolao-sao-jorge-abre-mes-2026-04`). Com **várias unidades**, o gerador acrescenta `-u1`, `-u2`, … para respeitar `UNIQUE (supermercado, nome_produto, run_id)`. |
| `meta.ingest_source` | recomendado | Rastreabilidade (ex.: `curadoria_json:sacolao_sao_jorge_abre_mes:2026-04-08`). |
| `meta.promotions_source` | opcional | Se definido, usado como `source` em `public.promotions`; senão = `ingest_source` + `:promotions_vm`. |
| `meta.validade_encarte_ate` / `expira_em` | recomendado | Validade global do encarte. |
| `produtos[]` | sim | `nome_produto`, `preco`, `categoria`; se o folheto tiver **ofertas por dia**, use `valid_from`, `valid_until`, `validity_note` por linha. |

**Duplicados no mesmo encarte:** se o mesmo `nome_produto` aparece mais de uma vez (dias diferentes), o gerador **desambigua** o nome (sufixo com nota/datas) para não violar a unicidade no mesmo `run_id`.

---

## Passo 1 — Loja em `public.stores`

- Nome coerente com o que o utilizador vê (ex.: contém **Sacolão**, **São Jorge**, **Vila Madalena** onde aplicável).
- `lat` / `lng` na fachada (Google Maps), alinhados à unidade correspondente em `meta.unidades[]`.
- Ajuste pontual de coordenadas: pode usar um ficheiro auxiliar em `data/curadoria/` (ex.: `sacolao-vila-madalena-store-e-ajuste-coords.sql`) se já existir no repositório.

---

## Passo 2 — Gerar SQL (na raiz do repositório)

```bash
# Tabela promocoes_supermercados (pins / ofertas por coordenada)
node scripts/generate-curadoria-promocoes-sql.mjs data/curadoria/SEU-ENCARTE.json data/curadoria/SEU-ENCARTE-insert.sql

# Tabela promotions — encarte no popup (1.ª entrada de meta.unidades = loja de referência no SQL gerado)
node scripts/generate-sacolao-promotions-table-sql.mjs data/curadoria/SEU-ENCARTE.json data/curadoria/SEU-ENCARTE-promotions-insert.sql
```

Sem argumentos, o segundo comando usa o JSON de exemplo no repositório e grava `*-promotions-insert.sql` ao lado do JSON. O `source` em `promotions` vem de `meta.promotions_source` ou `meta.ingest_source` + `:promotions_vm`.

---

## Passo 3 — Aplicar no Supabase

1. Abra o **SQL Editor** do projeto (o link “para copiar e não mudar” é o **mesmo** projeto; só executa o `.sql` gerado).
2. Cole e execute primeiro o `DELETE`/`UPDATE` de limpeza do lote antigo (incluído no `-insert.sql` da curadoria).
3. Execute os `INSERT` na ordem que fizer sentido (`promocoes_supermercados`, depois `promotions` se usar os dois).

Se aparecer **23505** (duplicado), confira `run_id`, unidades e nomes desambiguados — não force `INSERT` duplicado no mesmo lote.

---

## Passo 4 — Validar no app

1. `/mapa` com **Só promo** (se aplicável ao fluxo atual).
2. Pin laranja / ofertas da loja e popup com lista coerente com o folheto.
3. Se não aparecer nada: confira nome da loja em `stores`, coordenadas, `saojorge` no slug da rede e variáveis `MAP_STORE_OFFERS_*` em produção.

---

## Ver também

- `docs/instagram-curadoria-mercados-sp.example.json` — modelo de cadastro por unidade (Instagram); Sacolão segue o **mesmo espírito** (uma linha por unidade, coordenadas e escopo claros).
- `docs/CHECKLIST-PROMOCOES-POR-REDE.md` — priorização de redes e agente; Sacolão em **P3** pode usar o **agente** para outras fontes, mas a **curadoria folheto** é este documento.
- `scripts/generate-curadoria-promocoes-sql.mjs` — comentários no topo sobre `meta.unidades` e `run_id`.
