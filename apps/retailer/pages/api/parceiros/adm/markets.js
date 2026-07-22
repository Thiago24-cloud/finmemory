/** GET/POST/PATCH /api/parceiros/adm/markets */
import { requireAdmCompraApi } from '../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('adm_compra_markets')
      .select('*')
      .order('nome');
    if (error) return res.status(503).json({ error: error.message });
    return res.status(200).json({ markets: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const nome = String(body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome do mercado obrigatório' });
    const row = {
      nome,
      cidade: String(body.cidade || '').trim() || null,
      bairro: String(body.bairro || '').trim() || null,
      endereco: String(body.endereco || '').trim() || null,
      contato: String(body.contato || '').trim() || null,
      ativo: body.ativo !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('adm_compra_markets').insert(row).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ market: data });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = String(body.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id obrigatório' });
    const patch = { updated_at: new Date().toISOString() };
    for (const k of ['nome', 'cidade', 'bairro', 'endereco', 'contato']) {
      if (body[k] !== undefined) patch[k] = String(body[k] || '').trim() || null;
    }
    if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo);
    const { data, error } = await supabase
      .from('adm_compra_markets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ market: data });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Método não permitido' });
}
