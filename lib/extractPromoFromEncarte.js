import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isAllowedImageRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  const t = ref.trim();
  return t.startsWith('https://') || t.startsWith('data:image/');
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

function sanitizeUnit(raw) {
  if (raw == null) return null;
  const u = String(raw).replace(/\s+/g, ' ').trim().slice(0, 32);
  return u || null;
}

function todaySaoPauloDateString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Chama GPT-4o Vision na imagem do encarte, extrai produtos e grava em `public.promotions`.
 *
 * @param {string} imageUrl URL https:// da imagem ou data:image/...;base64,...
 * @param {string} storeName Nome da loja / rede exibido ao utilizador
 * @param {string} [storeId] UUID em public.stores (opcional — liga ao pin no /mapa)
 * @returns {Promise<{ ok: true, inserted: number, products: object[] } | { ok: false, error: string }>}
 */
export async function extractPromoFromEncarte(imageUrl, storeName, storeId = null) {
  const url = imageUrl != null ? String(imageUrl).trim() : '';
  const store = storeName != null ? String(storeName).trim().slice(0, 200) : '';

  if (!url) {
    return { ok: false, error: 'imageUrl é obrigatório' };
  }
  if (!isAllowedImageRef(url)) {
    return {
      ok: false,
      error: 'imageUrl deve ser https:// ou data:image/... (URLs não públicas podem falhar na API OpenAI)',
    };
  }
  if (!store) {
    return { ok: false, error: 'storeName é obrigatório' };
  }

  const openai = getOpenAI();
  if (!openai) {
    return { ok: false, error: 'OPENAI_API_KEY não configurada' };
  }

  const supabase = getSupabaseService();
  if (!supabase) {
    return { ok: false, error: 'Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) não configurado' };
  }

  const catList = VISION_CATEGORIES.join('|');
  const prompt = `Você analisa uma imagem de encarte ou folheto de supermercado (Brasil).

Extraia TODOS os produtos com preço promocional visível.

Regras:
- promo_price: preço da promoção (número decimal com ponto: 5.99), obrigatório por item.
- original_price: preço "de" / tachado, ou null.
- unit: kg | un | L | ml | g | pct | null.
- category: exatamente uma destas strings: ${catList} (use Outros se não encaixar).
- valid_until: data fim da oferta YYYY-MM-DD se constar no encarte; senão null.

Responda APENAS com JSON válido (sem markdown):
{"products":[{"product_name":"string","unit":string|null,"category":"Hortifruti","promo_price":number,"original_price":number|null,"valid_until":string|null}]}`;

  const model = process.env.EXTRACT_PROMO_VISION_MODEL || 'gpt-4o';
  const maxTokensRaw = Number.parseInt(process.env.OPENAI_VISION_MAX_TOKENS || '4096', 10);
  const maxTokens = Number.isFinite(maxTokensRaw)
    ? Math.min(16384, Math.max(512, maxTokensRaw))
    : 4096;

  const validFrom = todaySaoPauloDateString();

  let completion;
  try {
    completion = await openai.chat.completions.create({
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
    });
  } catch (e) {
    return { ok: false, error: e?.message || 'Falha na chamada OpenAI' };
  }

  const raw = completion?.choices?.[0]?.message?.content || '';
  const parsed = parseVisionJsonResponse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      error: 'Resposta do modelo não é JSON válido',
      preview: String(raw).slice(0, 400),
    };
  }

  const products = Array.isArray(parsed?.products) ? parsed.products : [];
  const seen = new Set();
  const rows = [];

  for (const p of products) {
    const product_name = sanitizeNome(p?.product_name);
    const promo_price = parsePromoPrice(p?.promo_price);
    if (!product_name || promo_price == null) continue;

    const key = product_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let original_price =
      p?.original_price != null && p.original_price !== ''
        ? parsePromoPrice(p.original_price)
        : null;
    if (original_price != null && !Number.isFinite(original_price)) {
      original_price = null;
    }

    let valid_until = null;
    if (p?.valid_until) {
      const vs = String(p.valid_until).trim();
      valid_until = /^\d{4}-\d{2}-\d{2}$/.test(vs) ? vs : null;
    }

    const row = {
      product_name,
      promo_price,
      original_price,
      unit: sanitizeUnit(p?.unit),
      category: sanitizeVisionCategory(p?.category),
      store_name: store,
      valid_from: validFrom,
      valid_until,
      active: true,
    };
    const sid = storeId != null ? String(storeId).trim() : '';
    if (sid) row.store_id = sid;
    rows.push(row);
  }

  if (!rows.length) {
    return {
      ok: true,
      inserted: 0,
      products: [],
      model,
      note: 'Nenhum produto com nome e preço promocional válidos',
      rawCount: products.length,
    };
  }

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error: insertErr } = await supabase.from('promotions').insert(slice);
    if (insertErr) {
      return { ok: false, error: insertErr.message };
    }
  }

  return {
    ok: true,
    inserted: rows.length,
    products: rows.map((r) => ({
      product_name: r.product_name,
      promo_price: r.promo_price,
      original_price: r.original_price,
      unit: r.unit,
      category: r.category,
      store_name: r.store_name,
      store_id: r.store_id ?? null,
      valid_from: r.valid_from,
      valid_until: r.valid_until,
      active: r.active,
    })),
    model,
  };
}
