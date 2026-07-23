/**
 * POST /api/parceiros/adm/users/[id]/map-quote
 * Lista do cliente + bairro/cidade → preços do mapa (Caça-Preço).
 */
import { requireAdmCompraApi } from '../../../../../../lib/adm/admCompra';
import { buildUserRegionAddress, runAdmMapQuote } from '../../../../../../lib/adm/runAdmMapQuote';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;
  const userId = String(req.query.id || '');
  if (!userId) return res.status(400).json({ error: 'id obrigatório' });

  const { data: user, error: uErr } = await supabase
    .from('adm_compra_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (uErr) return res.status(500).json({ error: uErr.message });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { data: list, error: lErr } = await supabase
    .from('adm_compra_list_items')
    .select('*, product:adm_compra_products(id, nome, unidade)')
    .eq('user_id', userId);
  if (lErr) return res.status(500).json({ error: lErr.message });

  const items = (list || [])
    .map((row) => String(row.product?.nome || '').trim())
    .filter((n) => n.length >= 2);

  if (!items.length) {
    return res.status(400).json({
      error: 'Este cliente ainda não tem itens na lista de compra.',
    });
  }

  const body = req.body || {};
  const address =
    String(body.address || '').trim() || buildUserRegionAddress(user);
  const radiusKm = Number(body.radius_km) || 8;

  const result = await runAdmMapQuote({
    supabase,
    items,
    address,
    phone: user.telefone,
    customerName: user.nome,
    radiusKm,
  });

  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }

  return res.status(200).json({
    ...result.payload,
    user: {
      id: user.id,
      nome: user.nome,
      telefone: user.telefone,
      cidade: user.cidade,
      bairro: user.bairro,
    },
    list_count: items.length,
  });
}
