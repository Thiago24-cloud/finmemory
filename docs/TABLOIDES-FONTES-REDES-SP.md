# Tabloides e ofertas — fontes por rede (referência)

Documento de apoio ao pipeline de promoções (`finmemory-agent`, `lib/ingest`, `POST /api/scrapers/import-dia-offers`).  
Objetivo: **preços alinhados à loja física** quando possível; delivery só quando for a única superfície com HTML estruturado (caso Sonda).

## Melhor sinal: tabloide digital no site da rede

| Rede | URL típica de ofertas | No FinMemory hoje |
|------|------------------------|-------------------|
| Dia | [dia.com.br/ofertas](https://www.dia.com.br/ofertas) + páginas por loja `/lojas/...` | Agente `dia` + `import-dia-offers` (GPT por URL de loja) |
| Pão de Açúcar | [paodeacucar.com/ofertas](https://www.paodeacucar.com/ofertas) | Agente `paodeacucar` |
| Assaí | [assai.com.br/ofertas](https://www.assai.com.br/ofertas) | Agente `assai` (JSON estático + fallback Playwright) |
| Atacadão | [atacadao.com.br/ofertas](https://www.atacadao.com.br/ofertas) | Agente `atacadao` |
| Sonda | [sonda.com.br/ofertas](https://www.sonda.com.br/ofertas) (institucional) | Ver linha abaixo |
| Sonda (e-commerce estruturado) | [sondadelivery.com.br](https://www.sondadelivery.com.br/) | Agente `sonda` (Playwright — **preços delivery**; validar vs gôndola se necessário) |
| Lopes | [supermercadolopes.com.br](https://www.supermercadolopes.com.br/) | Agente `lopes` (`/api/tabloides` + encartes) |
| Tauste | App próprio (tabloide) | **Não mapeado** — precisa engenharia reversa ou OCR |
| Padrão Supermercados | [padraosuper.com.br](https://www.padraosuper.com.br/) | **Não mapeado** — candidato a novo scraper ou agregador |

## Agregadores (atalho)

- **Super Panfletos / apps similares** — reúnem várias redes; úteis como atalho, mas **layout muda com frequência** e ToS pode restringir scraping.
- **catalogosofertas.com.br** — útil para redes regionais (ex.: Lopes, Padrão); mesmo cuidado de fragilidade.

**Recomendação:** priorizar **site oficial** ou **API/JSON** exposto pela rede; agregador só se o custo de manutenção valer a pena.

## O que **não** usar como proxy da gôndola

- **Economo (economo.com.br)** e marketplaces de delivery das grandes redes quando o preço é **só do app/e-commerce**, não do tabloide da loja física.
- **Encarte só em PDF/imagem** sem camada de texto: exige **OCR** (pipeline separado, custo e erro maiores). Muitos sites do Carrefour/Atacadão caem aqui — o agente já tenta fallback de **imagem de encarte** quando não há `R$` parseável.

## Ordem prática de implementação (pesquisa interna)

1. **Sites com preço em texto** (HTML/JSON) — menor resistência; ajustar seletores após `npm run dry-run` no agente.
2. **Dia por loja** — JS/render; URLs previsíveis; já há fluxo dedicado de import.
3. **Assaí** — seleção de loja no site pode exigir passos extras no Playwright.
4. **Sonda** — `sondadelivery.com.br` costuma expor `Por R$ …` em página; scraper `sonda` no agente; **fan-out** para lojas `stores` com nome contendo “Sonda”.
5. **OCR / WhatsApp / Instagram** — camada 2; ver `docs/MAPA-PRECOS-PROMOCOES-ESTRATEGIA.md`.

## Comandos úteis

```bash
cd finmemory-agent && npm install && npx playwright install chromium
node agent.js --dry-run --only=sonda
node agent.js --only=sonda
```

Raiz do monorepo: `npm run promo:agent` (todas as redes configuradas no script).

## Afinar seletores

Se `--dry-run` retornar **0 itens**, abrir o site no Chrome → Inspecionar → atualizar o `page.evaluate` da rede em `finmemory-agent/agent.js` (`SCRAPERS.<rede>.run`).
