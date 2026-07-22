/** GET/POST /api/parceiros/adm/users/[id]/lista — itens da lista de compra */
import { requireAdmCompraApi } from '../../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;
  const userId = String(req.query.id || '');
  if (!userId) return res.status(400).json({ error: 'id obrigatório' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('adm_compra_list_items')
      .select('*, product:adm_compra_products(id, nome, unidade, categoria)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ list: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const productId = String(body.product_id || '').trim();
    if (!productId) return res.status(400).json({ error: 'product_id obrigatório' });

    const row = {
      user_id: userId,
      product_id: productId,
      quantidade_media: String(body.quantidade_media || '').trim() || null,
      frequencia: String(body.frequencia || 'Semanal').trim(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('adm_compra_list_items')
      .upsert(row, { onConflict: 'user_id,product_id' })
      .select('*, product:adm_compra_products(id, nome, unidade, categoria)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  if (req.method === 'DELETE') {
    const itemId = String(req.body?.item_id || req.query.item_id || '').trim();
    if (!itemId) return res.status(400).json({ error: 'item_id obrigatório' });
    const { error } = await supabase
      .from('adm_compra_list_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Método não permitido' });
}
