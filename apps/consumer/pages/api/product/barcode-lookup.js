/**
 * GET /api/product/barcode-lookup?gtin=789...&lat=-23.55&lng=-46.63
 *
 * Nome/imagem: Supabase (products) → Open Food Facts → Cosmos Bluesoft (fallback);
 * histórico do usuário em NFC-e (cEAN nos itens) como antes.
 *
 * Preço no mapa: oferta mais próxima da localização (ou no mercado onde o utilizador está).
 */

import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '../auth/[...nextauth]';
import { lookupProductByGtin } from '../../../lib/gtinProductLookup';
import {
  buildBarcodePriceHints,
  fetchActiveMapOffersForProduct,
  pickBarcodeMapPriceHint,
} from '../../../lib/barcodeMapNearbyPrice';

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

function parseCoord(raw) {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function itemMatchesGtin(item, gtin) {
  if (!item || typeof item !== 'object') return false;
  const g = item.gtin != null ? String(item.gtin).replace(/\D/g, '') : '';
  if (g && g === gtin) return true;
  const code = item.codigo != null ? String(item.codigo).replace(/\D/g, '') : '';
  return code === gtin;
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

  const userLat = parseCoord(req.query.lat);
  const userLng = parseCoord(req.query.lng);

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

  let mapPick = null;
  if (supabase) {
    try {
      const offers = await fetchActiveMapOffersForProduct(supabase, {
        gtin,
        productName: openFoodFacts?.name || '',
      });
      mapPick = pickBarcodeMapPriceHint(offers, userLat, userLng);
    } catch (e) {
      console.warn('barcode-lookup map nearby:', e?.message || e);
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
              name: hit.name || null,
            });
          }
          if (yourPurchases.length >= 15) break;
        }
      }
    } catch (e) {
      console.warn('barcode-lookup transacoes:', e?.message || e);
    }
  }

  const priceHints = buildBarcodePriceHints(openFoodFacts, yourPurchases, mapPick);

  return res.status(200).json({
    gtin,
    openFoodFacts,
    yourPurchases,
    priceHints,
  });
}
