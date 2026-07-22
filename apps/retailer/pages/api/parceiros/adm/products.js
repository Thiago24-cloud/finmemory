/** GET/POST /api/parceiros/adm/products */
import { requireAdmCompraApi } from '../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const ativo = req.query.ativo;
    let query = supabase.from('adm_compra_products').select('*').order('nome');
    if (ativo === '1' || ativo === 'true') query = query.eq('ativo', true);
    if (ativo === '0' || ativo === 'false') query = query.eq('ativo', false);
    const { data, error } = await query;
    if (error) return res.status(503).json({ error: error.message });
    return res.status(200).json({ products: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const nome = String(body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome do produto obrigatório' });
    const row = {
      nome,
      categoria: String(body.categoria || '').trim() || null,
      unidade: String(body.unidade || 'un.').trim(),
      marca: String(body.marca || '').trim() || null,
      ativo: body.ativo !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('adm_compra_products').insert(row).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ product: data });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = String(body.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id obrigatório' });
    const patch = { updated_at: new Date().toISOString() };
    for (const k of ['nome', 'categoria', 'unidade', 'marca']) {
      if (body[k] !== undefined) patch[k] = String(body[k] || '').trim() || null;
    }
    if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo);
    const { data, error } = await supabase
      .from('adm_compra_products')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ product: data });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Método não permitido' });
}
