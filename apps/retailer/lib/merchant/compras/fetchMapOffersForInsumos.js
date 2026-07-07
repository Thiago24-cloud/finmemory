/**
 * Busca ofertas do mapa para insumos: GTIN (product_id) + RPC por termos enriquecidos.
 */
import { normalizeEanDigits } from '../mapInsumoRow';
import { collectRpcSearchTermsForInsumos } from './insumoMatchTerms';

function mapPricePointRow(row, insumoId, matchMethod) {
  const preco = Number(row.price);
  if (!Number.isFinite(preco) || preco <= 0) return null;
  return {
    lugar_id: `pp:${row.id}`,
    nome_loja: String(row.store_name || 'Mercado').trim() || 'Mercado',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    produto_nome: String(row.product_name || '').trim(),
    preco,
    origem: 'price_point',
    _insumoId: insumoId,
    _matchMethod: matchMethod,
  };
}

function mapPromoRow(row, insumoId, matchMethod) {
  const preco = Number(row.preco);
  if (!Number.isFinite(preco) || preco <= 0) return null;
  const nomeProduto = row.nome_produto || '';
  return {
    lugar_id: `promo:${row.id}`,
    nome_loja: String(row.supermercado || row.store_name || 'Mercado').trim() || 'Mercado',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    produto_nome: String(nomeProduto).trim(),
    preco,
    origem: 'promo_agent',
    _insumoId: insumoId,
    _matchMethod: matchMethod,
  };
}

function rowDedupeKey(row) {
  const lugar = String(row.lugar_id || row.nome_loja || '').trim();
  const nome = String(row.produto_nome || '').trim().toLowerCase();
  const preco = Number(row.preco);
  return `${lugar}|${nome}|${Number.isFinite(preco) ? preco.toFixed(2) : ''}`;
}

function mergeRows(target, rows) {
  const seen = new Set(target.map(rowDedupeKey));
  for (const row of rows || []) {
    const key = rowDedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(row);
  }
}

async function fetchGtinLinkedOffers(supabase, insumos) {
  const out = [];
  const withEan = (insumos || [])
    .map((i) => ({ ...i, ean: normalizeEanDigits(i.ean) }))
    .filter((i) => i.ean);

  if (!withEan.length) return out;

  const gtins = [...new Set(withEan.map((i) => i.ean))];
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, gtin, name')
    .in('gtin', gtins);

  if (prodErr || !products?.length) return out;

  const productByGtin = new Map(products.map((p) => [p.gtin, p]));
  const productIds = products.map((p) => p.id);

  const normalCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const promoCutoff = new Date(Date.now() - 168 * 3600 * 1000).toISOString();

  const { data: priceRows } = await supabase
    .from('price_points')
    .select('id, store_name, product_name, price, lat, lng, created_at, category, product_id')
    .in('product_id', productIds)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(200);

  const { data: promoRows } = await supabase
    .from('promocoes_supermercados')
    .select('id, supermercado, nome_produto, preco, lat, lng, ativo, expira_em, product_id')
    .in('product_id', productIds)
    .eq('ativo', true)
    .gt('expira_em', new Date().toISOString())
    .limit(200);

  for (const insumo of withEan) {
    const product = productByGtin.get(insumo.ean);
    if (!product?.id) continue;

    for (const row of priceRows || []) {
      if (row.product_id !== product.id) continue;
      const isPromo = String(row.category || '').toLowerCase().includes('promo');
      const cutoff = isPromo ? promoCutoff : normalCutoff;
      if (row.created_at && row.created_at < cutoff) continue;
      const mapped = mapPricePointRow(row, insumo.id, 'gtin');
      if (mapped) out.push(mapped);
    }

    for (const row of promoRows || []) {
      if (row.product_id !== product.id) continue;
      const mapped = mapPromoRow(row, insumo.id, 'gtin');
      if (mapped) out.push(mapped);
    }
  }

  return out;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array} insumos
 */
export async function fetchMapOffersForInsumos(supabase, insumos) {
  const merged = [];

  const gtinRows = await fetchGtinLinkedOffers(supabase, insumos);
  mergeRows(merged, gtinRows);

  const searchTerms = collectRpcSearchTermsForInsumos(insumos);
  if (searchTerms.length > 0) {
    const { data: rpcRows, error } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
      produtos: searchTerms,
    });
    if (!error && rpcRows?.length) {
      mergeRows(
        merged,
        rpcRows.map((row) => ({ ...row, _matchMethod: 'rpc' }))
      );
    }
  }

  return merged;
}
