/**
 * Parsing e normalização compartilhados entre
 * POST /api/map/quick-add-stream e POST /api/admin/quick-add
 *
 * Texto colado: preferir `nome;12,99` ou tab (planilha BR). Vírgula só como separador de preço
 * na última vírgula da linha — nomes com vírgula no meio quebram se usar CSV “ingênuo”.
 */

import { createClient } from '@supabase/supabase-js';

let supabaseQuickAddInstance = null;

export function getMapQuickAddSupabase() {
  if (!supabaseQuickAddInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseQuickAddInstance = createClient(url, key);
  }
  return supabaseQuickAddInstance;
}

export function parseBrazilianPrice(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return NaN;
  if (t.includes(',')) {
    return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(t);
}

export function normalizeProductRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => ({
      product_name: String(p.product_name ?? p.name ?? '').trim(),
      price: parseBrazilianPrice(p.price),
    }))
    .filter((p) => p.product_name && Number.isFinite(p.price) && p.price >= 0);
}

export function parseProductsFromBody(body) {
  if (Array.isArray(body.products) && body.products.length) {
    return normalizeProductRows(body.products);
  }
  const text = typeof body.productsText === 'string' ? body.productsText.trim() : '';
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) return normalizeProductRows(arr);
    } catch {
      /* fall through */
    }
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    let name;
    let priceRaw;
    const semi = line.match(/^(.+?)\s*[;\t]\s*([\d.,]+)\s*$/);
    if (semi) {
      [, name, priceRaw] = semi;
    } else {
      const idx = line.lastIndexOf(',');
      if (idx > 0) {
        const maybeName = line.slice(0, idx).trim();
        const maybePrice = line.slice(idx + 1).trim();
        if (maybeName && /^[\d.,]+$/.test(maybePrice)) {
          name = maybeName;
          priceRaw = maybePrice;
        }
      }
    }
    if (!name || priceRaw == null) continue;
    const price = parseBrazilianPrice(priceRaw);
    if (!Number.isFinite(price) || price < 0) continue;
    out.push({ product_name: name.trim(), price });
  }
  return out;
}

/** Payload do admin QuickAdd: { store: { name, address, cnpj?, lat?, lng? }, products } */
export function buildQuickAddPayloadFromAdminBody(body) {
  const store = body?.store && typeof body.store === 'object' ? body.store : {};
  const name = typeof store.name === 'string' ? store.name.trim() : '';
  const address = typeof store.address === 'string' ? store.address.trim() : '';
  const cnpj = typeof store.cnpj === 'string' ? store.cnpj.trim() : '';
  const latN = store.lat != null ? Number(store.lat) : NaN;
  const lngN = store.lng != null ? Number(store.lng) : NaN;
  const products = normalizeProductRows(body?.products);
  return {
    store_name: name,
    address,
    cnpj,
    lat: Number.isFinite(latN) ? latN : NaN,
    lng: Number.isFinite(lngN) ? lngN : NaN,
    category:
      typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null,
    continueOnError: body?.continueOnError !== false,
    products,
  };
}

export function digitsOnlyCnpj(cnpj) {
  return String(cnpj || '').replace(/\D/g, '');
}

/** Sessão NextAuth OU x-map-quick-add-secret + MAP_QUICK_ADD_BOT_USER_ID */
export function resolveQuickAddAuth(req, session) {
  const secret = process.env.MAP_QUICK_ADD_SECRET?.trim();
  const headerSecret = req.headers['x-map-quick-add-secret'] || req.headers['X-Map-Quick-Add-Secret'];
  const headerPresent = typeof headerSecret === 'string' && headerSecret.length > 0;
  if (headerPresent) {
    if (!secret) return { error: 'secret_not_configured' };
    if (headerSecret !== secret) return { error: 'invalid_secret' };
    const botId = process.env.MAP_QUICK_ADD_BOT_USER_ID?.trim();
    if (!botId) return { error: 'bot_user_missing' };
    return { userId: botId, via: 'secret' };
  }
  const userId = session?.user?.supabaseId;
  if (userId) return { userId, via: 'session' };
  return null;
}
