/** GET/PATCH/DELETE /api/parceiros/adm/users/[id] */
import { requireAdmCompraApi } from '../../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;
  const id = String(req.query.id || '');

  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  if (req.method === 'GET') {
    const [{ data: user, error: uErr }, { data: list, error: lErr }] = await Promise.all([
      supabase.from('adm_compra_users').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('adm_compra_list_items')
        .select('*, product:adm_compra_products(id, nome, unidade, categoria)')
        .eq('user_id', id)
        .order('created_at', { ascending: true }),
    ]);
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (lErr) return res.status(500).json({ error: lErr.message });
    return res.status(200).json({ user, list: list || [] });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const allowed = [
      'nome',
      'telefone',
      'cidade',
      'bairro',
      'perfil',
      'produto_principal',
      'plano',
      'dia_compra',
      'status',
      'observacoes',
    ];
    const patch = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) {
        const v = body[k];
        patch[k] = v === '' || v == null ? null : String(v).trim();
      }
    }
    if (patch.nome === null) return res.status(400).json({ error: 'Nome não pode ser vazio' });
    if (patch.telefone === null) return res.status(400).json({ error: 'Telefone não pode ser vazio' });

    const { data, error } = await supabase
      .from('adm_compra_users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ user: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('adm_compra_users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'Método não permitido' });
}
