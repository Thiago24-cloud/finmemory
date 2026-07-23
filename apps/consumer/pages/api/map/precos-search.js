/**
 * GET /api/map/precos-search?q=feijão&lat=&lng=
 * Busca preços no mapa (mesma RPC do Parceiros) — app consumidor e lojistas.
 */
import { createClient } from '@supabase/supabase-js';
import { isSimulatedMapProductName } from '../../../lib/mapSimulatedOffers';
import { compareListWithMapOffers } from '../../../lib/shoppingListMapMatch';
import { isPlausiblePromoPrice } from '../../../lib/offerPriceSanity';
import { resolveProductThumbnailUrl } from '../../../lib/mapProductImageCache';

const CHAIN_COLORS = {
  dia: '#e30613',
  atacadao: '#f7941d',
  atacadão: '#f7941d',
  sonda: '#0066b3',
  mambo: '#7c3aed',
  assai: '#00a651',
  carrefour: '#004e9f',
  extra: '#e30613',
};

function pickStoreColor(name, index) {
  const key = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  for (const [chain, color] of Object.entries(CHAIN_COLORS)) {
    if (key.includes(chain)) return color;
  }
  const palette = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#0891b2', '#9333ea'];
  return palette[index % palette.length];
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveImagesBatch(supabase, names) {
  const unique = Array.from(
    new Set((names || []).map((n) => String(n || '').trim()).filter((n) => n.length >= 2))
  ).slice(0, 24);
  const out = new Map();
  const concurrency = 4;
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (name) => {
        try {
          const r = await resolveProductThumbnailUrl(supabase, name, '', { useGoogleCse: false });
          return [name, { url: r?.url || null, source: r?.source || null }];
        } catch {
          return [name, { url: null, source: null }];
        }
      })
    );
    for (const [name, r] of results) out.set(name, r);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = String(req.query.q || req.query.product || req.query.names || '').trim();
  const names = q
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((n) => n.length >= 2)
    .slice(0, 24);

  if (!names.length) {
    return res.status(200).json({
      product: null,
      products: [],
      mapStores: [],
      stores: [],
      summary: { matched: 0, total: 0, storesCount: 0 },
      items: [],
    });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado' });

  const { data: rpcRows, error } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: names,
  });

  if (error) {
    console.warn('[map/precos-search]', error.message);
    return res.status(500).json({ error: 'Não foi possível buscar preços no mapa.' });
  }

  const rows = (rpcRows || [])
    .filter((r) => !isSimulatedMapProductName(r.produto_nome))
    .filter((r) => isPlausiblePromoPrice(r.produto_nome, Number(r.preco)));

  const storesByName = new Map();
  for (const row of rows) {
    const key = row.nome_loja || 'Mercado';
    const preco = Number(row.preco);
    if (!Number.isFinite(preco) || preco <= 0) continue;
    if (!storesByName.has(key)) {
      storesByName.set(key, {
        nome_loja: key,
        lugar_id: row.lugar_id,
        lat: row.lat,
        lng: row.lng,
        preco,
        produto_nome: row.produto_nome,
        expires_at: row.expires_at || null,
        offers: [],
      });
    }
    const entry = storesByName.get(key);
    entry.offers.push(row);
    if (preco < entry.preco) {
      entry.preco = preco;
      entry.produto_nome = row.produto_nome;
      entry.expires_at = row.expires_at || null;
      entry.lat = row.lat ?? entry.lat;
      entry.lng = row.lng ?? entry.lng;
    }
  }

  const storeList = [...storesByName.values()].sort((a, b) => a.preco - b.preco);
  const listCompare = compareListWithMapOffers(names, rows);

  const imageNames = [
    ...names,
    ...(listCompare.items || []).flatMap((it) =>
      [it.listName, it.bestOffer?.produto_nome].filter(Boolean)
    ),
    ...storeList.map((s) => s.produto_nome).filter(Boolean),
  ];
  const imageMap = await resolveImagesBatch(supabase, imageNames);

  const mapStores = storeList.map((s, i) => {
    const img = imageMap.get(s.produto_nome) || imageMap.get(names[0]);
    return {
      ...s,
      name: s.nome_loja,
      price: s.preco,
      color: pickStoreColor(s.nome_loja, i),
      lat: s.lat != null ? Number(s.lat) : null,
      lng: s.lng != null ? Number(s.lng) : null,
      image_url: img?.url || null,
      product_image_url: img?.url || null,
    };
  });

  const items = (listCompare.items || []).map((it) => {
    const fromList = imageMap.get(it.listName);
    const fromOffer = it.bestOffer?.produto_nome
      ? imageMap.get(it.bestOffer.produto_nome)
      : null;
    const img = fromList?.url ? fromList : fromOffer;
    return {
      ...it,
      image_url: img?.url || it.image_url || null,
      image_source: img?.source || null,
    };
  });

  const storesCompared = (listCompare.stores || []).map((s) => ({
    ...s,
    lines: (s.lines || []).map((l) => {
      const img =
        imageMap.get(l.listName) || (l.productName ? imageMap.get(l.productName) : null);
      return {
        ...l,
        image_url: img?.url || l.image_url || null,
        image_source: img?.source || null,
      };
    }),
  }));

  const product = names[0];
  const productImage = imageMap.get(product);

  return res.status(200).json({
    product,
    product_image_url: productImage?.url || null,
    products: names.map((name, i) => ({
      id: `q-${i}`,
      name,
      image_url: imageMap.get(name)?.url || null,
    })),
    mapStores,
    stores: storeList,
    summary: {
      matched: listCompare.summary?.matched ?? (mapStores.length > 0 ? 1 : 0),
      total: names.length,
      storesCount: listCompare.summary?.storesCount ?? mapStores.length,
    },
    items,
    listCompare: {
      ...listCompare,
      items,
      stores: storesCompared,
    },
  });
}
