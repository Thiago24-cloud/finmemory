/**
 * Prompt GPT para extrair ofertas de páginas de loja física no site DIA (dia.com.br/lojas/...).
 * Referência de layout: grade de produtos com "De" (riscado) + "Por" (promoção), "Válida até DD/MM/AAAA",
 * categorias (Hortifruti, Mercearia, etc.) e texto de exclusividade para loja física.
 *
 * Usado por: POST /api/scrapers/import-dia-offers, jobs/agent.js (scrapeDia).
 */

/**
 * @param {string} truncatedPlainText - texto plano derivado do HTML (limite de tamanho já aplicado pelo caller)
 * @returns {string}
 */
function buildDiaOffersExtractionPrompt(truncatedPlainText) {
  return `Você vai extrair PROMOÇÕES ATIVAS da página de uma LOJA FÍSICA do supermercado DIA (site dia.com.br).

Contexto típico da página (ex.: loja em São Paulo — Pinheiros, Rua Teodoro Sampaio):
- URL no padrão https://dia.com.br/lojas/<estado>-<cidade>-<bairro>-<rua>-<numero>/
- Grade de produtos: nome + embalagem (ex.: "Bandeja c/ 12 un.", "500 g", "100 g")
- Preço "De X,XX" (referência, pode estar riscado no site) e preço promocional em destaque "Por Y,YY" ou valor principal em vermelho — use SEMPRE o preço promocional vigente (o "Por"), nunca só o "De"
- Linha "Válida até DD/MM/AAAA" por oferta ou bloco — converta para valid_until em YYYY-MM-DD
- Faixas de categoria no topo (Todos, Produtos DIA, Hortifruti, Mercearia, Bebidas, etc.) — não é obrigatório repetir categoria no JSON; foque em produto + preço + validade
- Texto de que ofertas são para loja física — ainda assim extraia todas as ofertas visíveis na página

Regras:
- Retorne SOMENTE JSON válido, sem markdown.
- Cada oferta: product_name (inclua quantidade/embalagem no nome se estiver no cartão do produto), promo_price (número decimal, ex.: 8.99), valid_until (YYYY-MM-DD ou null)
- Não inclua item sem preço promocional claro.
- store_name: use o nome da loja/endereço como aparece na página (ex.: "Dia Teodoro Sampaio" ou título da loja), de forma consistente para geocoding.

JSON esperado:
{
  "store_name": string,
  "offers": [
    {
      "product_name": string,
      "promo_price": number,
      "valid_until": string | null
    }
  ]
}

Conteúdo (texto extraído do HTML):
${truncatedPlainText}`;
}

module.exports = { buildDiaOffersExtractionPrompt };
