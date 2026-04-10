'use strict';

/**
 * Extrai produtos de uma imagem de encarte via OpenAI Vision (REST).
 * Usado pelo agent antes de gravar em promocoes_supermercados.
 */

const VISION_CATEGORIES = [
  'Hortifruti',
  'Carnes',
  'Laticínios',
  'Bebidas',
  'Mercearia',
  'Higiene',
  'Limpeza',
  'Congelados',
  'Outros',
];

function sanitizeVisionCategory(raw) {
  if (raw == null) return null;
  const t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const c of VISION_CATEGORIES) {
    if (c.toLowerCase() === lower) return c;
  }
  return 'Outros';
}

function parseVisionJsonResponse(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let v = tryParse(cleaned);
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    v = tryParse(cleaned.slice(start, end + 1));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  const aStart = cleaned.indexOf('[');
  const aEnd = cleaned.lastIndexOf(']');
  if (aStart !== -1 && aEnd > aStart) {
    v = tryParse(cleaned.slice(aStart, aEnd + 1));
    if (Array.isArray(v)) return { products: v };
  }
  return null;
}

function sanitizeNome(s) {
  if (s == null) return '';
  return String(s).replace(/\s+/g, ' ').trim().slice(0, 280);
}

function parsePromoPrice(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatPrecoOriginalDePor(orig, promo) {
  if (orig == null && promo == null) return null;
  const parts = [];
  if (orig != null && Number.isFinite(Number(orig))) {
    parts.push(`De R$ ${Number(orig).toFixed(2).replace('.', ',')}`);
  }
  if (promo != null && Number.isFinite(Number(promo))) {
    parts.push(`Por R$ ${Number(promo).toFixed(2).replace('.', ',')}`);
  }
  return parts.length ? parts.join(' ') : null;
}

function isAllowedImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return String(url).trim().startsWith('https://');
}

/**
 * @param {string} imageUrl
 * @param {{ apiKey?: string, model?: string, maxTokens?: number }} [options]
 * @returns {Promise<{ products: object[], error?: string }>}
 */
async function extractProductsFromEncarteImage(imageUrl, options = {}) {
  const url = imageUrl != null ? String(imageUrl).trim() : '';
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!url || !isAllowedImageUrl(url)) {
    return { products: [], error: 'imageUrl https:// obrigatório' };
  }
  if (!apiKey) {
    return { products: [], error: 'OPENAI_API_KEY ausente' };
  }

  const catList = VISION_CATEGORIES.join('|');
  const prompt = `Você analisa uma imagem de encarte ou folheto de supermercado (Brasil).

Extraia TODOS os produtos com preço promocional visível.

Regras:
- Use preço promocional (ex.: "Por R$ 5,99"); se houver "De X Por Y", preencha original_price com X e promo_price com Y.
- promo_price é obrigatório por item (número decimal, ponto como separador: 5.99).
- original_price: número ou null se não houver preço "de/tachado".
- unit: kg | un | L | ml | g | pct | null se não der para inferir.
- category: exatamente uma destas strings: ${catList} (use Outros se não encaixar).
- valid_until: data de fim da oferta no formato YYYY-MM-DD se aparecer no encarte; senão null.
- brand: marca se clara; senão null.

Responda APENAS com JSON válido neste formato (sem markdown):
{"products":[{"product_name":"string","brand":string|null,"unit":string|null,"category":"Hortifruti","promo_price":number,"original_price":number|null,"valid_until":string|null}]}`;

  const model = options.model || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const maxTokensRaw = Number.parseInt(
    String(options.maxTokens ?? process.env.OPENAI_VISION_MAX_TOKENS ?? '4096'),
    10
  );
  const maxTokens = Number.isFinite(maxTokensRaw)
    ? Math.min(16384, Math.max(512, maxTokensRaw))
    : 4096;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url, detail: 'high' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      products: [],
      error: `OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`,
    };
  }

  const body = await res.json();
  const raw = body?.choices?.[0]?.message?.content || '';
  const parsed = parseVisionJsonResponse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { products: [], error: 'Resposta do modelo não é JSON válido' };
  }

  const list = Array.isArray(parsed.products) ? parsed.products : [];
  const seen = new Set();
  const products = [];

  for (const p of list) {
    const product_name = sanitizeNome(p?.product_name);
    const promo = parsePromoPrice(p?.promo_price);
    if (!product_name || promo == null) continue;
    const orig =
      p?.original_price != null && p.original_price !== ''
        ? parsePromoPrice(p.original_price)
        : null;
    const key = product_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let valid_until = null;
    if (p?.valid_until) {
      const vs = String(p.valid_until).trim();
      valid_until = /^\d{4}-\d{2}-\d{2}$/.test(vs) ? vs : null;
    }

    products.push({
      product_name,
      promo_price: promo,
      original_price: orig,
      valid_until,
      preco_original_display: formatPrecoOriginalDePor(orig, promo),
      category: sanitizeVisionCategory(p?.category),
      unit: p?.unit != null ? String(p.unit).slice(0, 32) : null,
    });
  }

  return { products };
}

module.exports = {
  extractProductsFromEncarteImage,
  VISION_CATEGORIES,
};
