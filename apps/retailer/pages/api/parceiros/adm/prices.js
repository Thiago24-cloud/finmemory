/** GET/POST /api/parceiros/adm/prices */
import { requireAdmCompraApi } from '../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const productId = req.query.product_id ? String(req.query.product_id) : null;
    const marketId = req.query.market_id ? String(req.query.market_id) : null;
    let query = supabase
      .from('adm_compra_prices')
      .select(
        `
        *,
        product:adm_compra_products(id, nome, unidade),
        market:adm_compra_markets(id, nome, bairro)
      `
      )
      .order('data_preco', { ascending: false })
      .limit(200);
    if (productId) query = query.eq('product_id', productId);
    if (marketId) query = query.eq('market_id', marketId);
    const { data, error } = await query;
    if (error) return res.status(503).json({ error: error.message });
    return res.status(200).json({ prices: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const product_id = String(body.product_id || '').trim();
    const market_id = String(body.market_id || '').trim();
    const preco = Number(body.preco);
    if (!product_id || !market_id || !Number.isFinite(preco) || preco < 0) {
      return res.status(400).json({ error: 'product_id, market_id e preco válidos são obrigatórios' });
    }
    const row = {
      product_id,
      market_id,
      preco,
      data_preco: String(body.data_preco || new Date().toISOString().slice(0, 10)),
      observacao: String(body.observacao || '').trim() || null,
      fonte: String(body.fonte || '').trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('adm_compra_prices')
      .insert(row)
      .select(
        `
        *,
        product:adm_compra_products(id, nome, unidade),
        market:adm_compra_markets(id, nome, bairro)
      `
      )
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ price: data });
  }

  if (req.method === 'DELETE') {
    const id = String(req.body?.id || req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id obrigatório' });
    const { error } = await supabase.from('adm_compra_prices').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Método não permitido' });
}
