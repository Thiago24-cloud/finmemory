/**
 * Seed demo SP: cesta básica em redes conhecidas (Pinheiros / Vila Madalena).
 * Grava em promocoes_supermercados (visível na RPC da lista) + cache de imagens.
 */

export const DEMO_INGEST_SOURCE = 'demo_seed:cesta_basica_wa:v1';

/** Endereço tipado para colar no teste WhatsApp. */
export const DEMO_SAMPLE_PASTE = `Rua Fradique Coutinho 914, Vila Madalena, São Paulo - SP
11987654321
Arroz
Feijão
Batata frita
Óleo
Leite`;

const STORES = [
  {
    name: 'Supermercado DIA Vila Madalena',
    lat: -23.5532,
    lng: -46.6915,
  },
  {
    name: 'Assaí Atacadista',
    lat: -23.5458,
    lng: -46.6521,
  },
  {
    name: 'Carrefour Express Pinheiros',
    lat: -23.5614,
    lng: -46.6822,
  },
  {
    name: 'Pão de Açúcar Vila Madalena',
    lat: -23.5491,
    lng: -46.6934,
  },
];

/** Preços por loja × produto (BRL). */
const BASKET = [
  {
    product: 'Arroz tipo 1 5kg',
    prices: [22.9, 19.9, 24.5, 26.9],
    imageHint: 'arroz',
  },
  {
    product: 'Feijão carioca 1kg',
    prices: [7.49, 6.29, 7.99, 8.49],
    imageHint: 'feijao carioca',
  },
  {
    product: 'Batata frita palito 400g',
    prices: [12.9, 11.49, 13.5, 14.9],
    imageHint: 'batata frita',
  },
  {
    product: 'Óleo de soja 900ml',
    prices: [6.99, 5.89, 7.29, 7.99],
    imageHint: 'oleo de soja',
  },
  {
    product: 'Leite integral 1L',
    prices: [4.89, 4.29, 5.19, 5.49],
    imageHint: 'leite integral',
  },
];

/**
 * URLs OFF estáveis para bootstrap do cache (evita gastar Cosmos no 1º seed).
 * Podem falhar se OFF mudar — o resolver cobre o fallback.
 */
const BOOTSTRAP_IMAGES = {
  arroz: 'https://images.openfoodfacts.org/images/products/789/600/400/0151/front_pt.4.400.jpg',
  'feijao carioca':
    'https://images.openfoodfacts.org/images/products/789/600/581/0907/front_pt.4.400.jpg',
  'batata frita':
    'https://images.openfoodfacts.org/images/products/789/284/081/5016/front_pt.6.400.jpg',
  'oleo de soja':
    'https://images.openfoodfacts.org/images/products/789/603/609/0112/front_pt.4.400.jpg',
  'leite integral':
    'https://images.openfoodfacts.org/images/products/789/100/010/0103/front_pt.21.400.jpg',
};

function normalizeKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function seedWhatsappQuoteDemo(supabase) {
  await supabase.from('promocoes_supermercados').delete().eq('ingest_source', DEMO_INGEST_SOURCE);

  const expira = new Date();
  expira.setDate(expira.getDate() + 14);
  const nowIso = new Date().toISOString();
  const validade = expira.toISOString().slice(0, 10);

  const rows = [];
  for (let si = 0; si < STORES.length; si++) {
    const store = STORES[si];
    for (const item of BASKET) {
      rows.push({
        supermercado: store.name,
        nome_produto: item.product,
        preco: item.prices[si],
        categoria: 'Supermercado - Promoção',
        lat: store.lat,
        lng: store.lng,
        ativo: true,
        expira_em: expira.toISOString(),
        validade,
        atualizado_em: nowIso,
        ingest_source: DEMO_INGEST_SOURCE,
        run_id: 'cesta-basica-wa-v1',
      });
    }
  }

  const { error: insertErr } = await supabase.from('promocoes_supermercados').insert(rows);
  if (insertErr) {
    return { ok: false, error: insertErr.message, inserted: 0 };
  }

  const cacheRows = [];
  for (const item of BASKET) {
    const hint = item.imageHint;
    const url = BOOTSTRAP_IMAGES[hint];
    if (!url) continue;
    const keys = [item.product, hint, hint.split(' ')[0]];
    for (const k of keys) {
      const norm = normalizeKey(k);
      if (norm.length < 2) continue;
      cacheRows.push({
        norm_key: norm,
        display_name: item.product,
        image_url: url,
        source: 'demo_seed_off',
        updated_at: nowIso,
      });
    }
  }

  if (cacheRows.length) {
    const { error: cacheErr } = await supabase
      .from('map_product_image_cache')
      .upsert(cacheRows, { onConflict: 'norm_key' });
    if (cacheErr) {
      console.warn('[seed-quote-demo/cache]', cacheErr.message);
    }
  }

  return {
    ok: true,
    inserted: rows.length,
    stores: STORES.map((s) => s.name),
    products: BASKET.map((b) => b.product),
    sample_paste: DEMO_SAMPLE_PASTE,
    ingest_source: DEMO_INGEST_SOURCE,
  };
}
