/**
 * GET /api/product/barcode-lookup?gtin=789...
 *
 * Nome/imagem: Supabase (products) → Open Food Facts → Cosmos Bluesoft (fallback);
 * histórico do usuário em NFC-e (cEAN nos itens) como antes.
 *
 * Token Cosmos (servidor): COSMOS_API_TOKEN — ver .env.example
 */

import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '../auth/[...nextauth]';
import { lookupProductByGtin } from '../../../lib/gtinProductLookup';

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

function normalizeGtin(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

function itemMatchesGtin(item, gtin) {
  if (!item || typeof item !== 'object') return false;
  const g = item.gtin != null ? String(item.gtin).replace(/\D/g, '') : '';
  if (g && g === gtin) return true;
  const code = item.codigo != null ? String(item.codigo).replace(/\D/g, '') : '';
  return code === gtin;
}

/** Evita que `%` / `_` quebrem o padrão ILIKE. */
function sanitizeIlikePattern(s) {
  return String(s || '')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Menor preço no mapa (price_points) cujo nome se pareça com o produto identificado (Cosmos/OFF).
 */
async function fetchBestMapPriceHint(supabase, productName) {
  const raw = String(productName || '').trim();
  if (raw.length < 3) return null;

  const tryQuery = async (pattern) => {
    if (pattern.length < 3) return null;
    const safe = sanitizeIlikePattern(pattern.slice(0, 60));
    const { data, error } = await supabase
      .from('price_points')
      .select('store_name, price, product_name, created_at')
      .ilike('product_name', `%${safe}%`)
      .order('price', { ascending: true })
      .limit(12);
    if (error) {
      console.warn('barcode-lookup map hint:', error.message);
      return null;
    }
    if (!data?.length) return null;
    const row = data[0];
    const p = Number(row.price);
    if (!Number.isFinite(p)) return null;
    return {
      price: p,
      store_name: row.store_name || '',
      product_name: row.product_name || '',
    };
  };

  let best = await tryQuery(raw);
  if (!best && raw.includes(' ')) {
    const first = raw.split(/\s+/).find((w) => w.length >= 4);
    if (first) best = await tryQuery(first);
  }
  return best;
}

function buildPriceHints(openFoodFacts, yourPurchases, mapBest) {
  let referencePrice = null;
  let referenceStore = null;
  if (yourPurchases?.length) {
    const p0 = yourPurchases[0];
    const raw = p0?.price;
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    referencePrice = Number.isFinite(n) ? n : null;
    referenceStore = p0?.estabelecimento || null;
  }

  const bestPrice = mapBest?.price != null ? Number(mapBest.price) : null;
  const bestStoreName = mapBest?.store_name || null;
  const bestProductName = mapBest?.product_name || null;

  let economyVsBest = null;
  if (referencePrice != null && bestPrice != null && bestPrice > 0) {
    economyVsBest = referencePrice - bestPrice;
  }

  return {
    referencePrice,
    referenceStore,
    bestPrice: bestPrice != null && Number.isFinite(bestPrice) ? bestPrice : null,
    bestStoreName,
    bestProductName,
    economyVsBest,
    hasMapData: Boolean(mapBest),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const gtin = normalizeGtin(req.query.gtin);
  if (!gtin) {
    return res.status(400).json({ error: 'gtin inválido (use 8 a 14 dígitos)' });
  }

  const supabase = getSupabase();
  const userId = session.user?.supabaseId;
  if (!supabase) {
    return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
  }

  let openFoodFacts = null;
  try {
    openFoodFacts = await lookupProductByGtin(gtin, { supabase });
  } catch (e) {
    console.warn('barcode-lookup lookup:', e?.message || e);
  }

  let mapBest = null;
  if (openFoodFacts?.name && supabase) {
    try {
      mapBest = await fetchBestMapPriceHint(supabase, openFoodFacts.name);
    } catch (e) {
      console.warn('barcode-lookup mapBest:', e?.message || e);
    }
  }

  let yourPurchases = [];
  if (userId) {
    try {
      const { data: rows, error } = await supabase
        .from('transacoes')
        .select('estabelecimento, data, items, cnpj')
        .eq('user_id', userId)
        .not('items', 'is', null)
        .order('data', { ascending: false })
        .limit(120);

      if (!error && Array.isArray(rows)) {
        for (const row of rows) {
          const items = row.items;
          if (!Array.isArray(items)) continue;
          const hit = items.find((it) => itemMatchesGtin(it, gtin));
          if (hit) {
            yourPurchases.push({
              estabelecimento: row.estabelecimento || '',
              data: row.data || '',
              price: typeof hit.price === 'number' ? hit.price : parseFloat(hit.price) || null,
              name: hit.name || null
            });
          }
          if (yourPurchases.length >= 15) break;
        }
      }
    } catch (e) {
      console.warn('barcode-lookup transacoes:', e?.message || e);
    }
  }

  const priceHints = buildPriceHints(openFoodFacts, yourPurchases, mapBest);

  return res.status(200).json({
    gtin,
    openFoodFacts,
    yourPurchases,
    priceHints
  });
}
