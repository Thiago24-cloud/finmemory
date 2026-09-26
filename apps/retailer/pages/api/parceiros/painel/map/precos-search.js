/** GET /api/parceiros/painel/map/precos-search?q=manga&lat=&lng= */
import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { compareListWithMapOffers } from '../../../../../lib/shoppingListMapCompare';
import { projectStoresToMap } from '../../../../../lib/merchant/precos/projectMapStores';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireMerchantApi(req, res);
  if (!ctx) return;

  const { supabase, store } = ctx;
  const q = String(req.query.q || req.query.product || '').trim();
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const center = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  const { data: insumos, error: insErr } = await supabase
    .from('insumos_loja')
    .select('id, nome, quantidade_atual, estoque_minimo, unidade, ativo')
    .eq('loja_id', store.id)
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .limit(200);

  if (insErr && !/insumos_loja/i.test(insErr.message || '')) {
    return res.status(500).json({ error: insErr.message });
  }

  const insumoRows = insumos || [];
  const lowStock = insumoRows.filter(
    (i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo || 0)
  );
  const catalogProducts = insumoRows.map((i) => ({
    id: i.id,
    name: i.nome,
    quantity: Number(i.quantidade_atual) || 0,
    minStock: Number(i.estoque_minimo) || 0,
    unit: i.unidade || 'un',
    lowStock: Number(i.quantidade_atual) <= Number(i.estoque_minimo || 0),
  }));

  const searchProduct = q || (lowStock[0]?.nome ?? catalogProducts[0]?.name ?? '');
  if (!searchProduct || searchProduct.length < 2) {
    return res.status(200).json({
      product: null,
      products: catalogProducts,
      stores: [],
      mapStores: [],
      summary: { matched: 0, total: 0, storesCount: 0 },
    });
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: [searchProduct],
  });

  if (rpcErr) {
    console.warn('[map/precos-search]', rpcErr.message);
    return res.status(500).json({ error: 'Não foi possível buscar preços no mapa.' });
  }

  const compared = compareListWithMapOffers([searchProduct], rpcRows);
  const item = compared.items?.[0];
  const offers = item?.offers || [];

  const storesByName = new Map();
  for (const offer of offers) {
    const key = offer.nome_loja || 'Mercado';
    if (!storesByName.has(key)) {
      storesByName.set(key, {
        nome_loja: key,
        lugar_id: offer.lugar_id,
        lat: offer.lat,
        lng: offer.lng,
        preco: offer.preco,
        produto_nome: offer.produto_nome,
        expires_at: offer.expires_at || null,
        created_at: offer.created_at || null,
        offers: [],
      });
    }
    const entry = storesByName.get(key);
    entry.offers.push(offer);
    if (offer.preco < entry.preco) {
      entry.preco = offer.preco;
      entry.produto_nome = offer.produto_nome;
      entry.expires_at = offer.expires_at || null;
      entry.created_at = offer.created_at || null;
    }
  }

  const storeList = [...storesByName.values()].sort((a, b) => a.preco - b.preco);
  const mapStores = projectStoresToMap(storeList, center || { lat: store.lat, lng: store.lng });

  return res.status(200).json({
    product: searchProduct,
    products: catalogProducts,
    item,
    stores: storeList,
    mapStores,
    summary: compared.summary,
    storeTotals: compared.stores,
  });
}
