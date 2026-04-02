/**
 * GET /api/product/barcode-lookup?gtin=789...
 *
 * Dados públicos (Open Food Facts) + histórico do usuário em transações NFC-e
 * cujo XML inclui cEAN (gtin nos itens).
 */

import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '../auth/[...nextauth]';

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
    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(gtin)}.json?fields=product_name,product_name_pt,brands,image_front_small_url,image_url`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    let offRes;
    try {
      offRes = await fetch(offUrl, {
        headers: { 'User-Agent': 'FinMemory/1.0 (barcode-lookup)' },
        signal: ac.signal
      });
    } finally {
      clearTimeout(t);
    }
    if (offRes.ok) {
      const offJson = await offRes.json();
      if (offJson?.status === 1 && offJson.product) {
        const p = offJson.product;
        openFoodFacts = {
          name: p.product_name_pt || p.product_name || null,
          brands: p.brands || null,
          imageUrl: p.image_front_small_url || p.image_url || null
        };
      }
    }
  } catch (e) {
    console.warn('barcode-lookup OFF:', e?.message || e);
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

  return res.status(200).json({
    gtin,
    openFoodFacts,
    yourPurchases
  });
}
