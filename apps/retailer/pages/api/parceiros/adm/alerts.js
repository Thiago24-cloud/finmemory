/**
 * POST /api/parceiros/adm/alerts/generate
 * Body: { user_id } → monta mensagem WhatsApp + salva alerta
 * PATCH: { alert_id, enviado: true } → marca enviado
 */
import {
  requireAdmCompraApi,
  getBestPricesForProducts,
  buildAlertMessage,
  normalizeWhatsAppDigits,
} from '../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const alertaHoje = req.query.alerta_hoje === '1' || req.query.alerta_hoje === 'true';
    const dias = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    const { cidade, bairro, perfil, dia_compra, produto_id } = req.query;

    let userIdsFilter = null;
    if (produto_id) {
      const { data: listRows, error: listErr } = await supabase
        .from('adm_compra_list_items')
        .select('user_id')
        .eq('product_id', String(produto_id));
      if (listErr) return res.status(503).json({ error: listErr.message });
      userIdsFilter = [...new Set((listRows || []).map((r) => r.user_id))];
      if (userIdsFilter.length === 0) {
        return res.status(200).json({ users: [] });
      }
    }

    let query = supabase
      .from('adm_compra_users')
      .select('id, nome, telefone, perfil, bairro, cidade, dia_compra, status, plano')
      .in('status', ['Ativo', 'Em teste'])
      .order('nome');
    if (alertaHoje) {
      query = query.eq('dia_compra', dias[new Date().getDay()]);
    }
    if (cidade) query = query.ilike('cidade', `%${String(cidade)}%`);
    if (bairro) query = query.ilike('bairro', `%${String(bairro)}%`);
    if (perfil) query = query.eq('perfil', String(perfil));
    if (dia_compra) query = query.eq('dia_compra', String(dia_compra));
    if (userIdsFilter) query = query.in('id', userIdsFilter);

    const { data, error } = await query;
    if (error) return res.status(503).json({ error: error.message });
    return res.status(200).json({ users: data || [] });
  }

  if (req.method === 'POST') {
    const userId = String(req.body?.user_id || '').trim();
    if (!userId) return res.status(400).json({ error: 'user_id obrigatório' });

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

    const productIds = (list || []).map((i) => i.product_id);
    let bestPrices = new Map();
    try {
      bestPrices = await getBestPricesForProducts(supabase, productIds);
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erro ao buscar preços' });
    }

    const built = buildAlertMessage({ user, listItems: list || [], bestPrices });
    const waDigits = normalizeWhatsAppDigits(user.telefone);
    const waUrl = waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(built.mensagem)}`
      : null;

    const { data: alert, error: aErr } = await supabase
      .from('adm_compra_alerts')
      .insert({
        user_id: userId,
        mensagem: built.mensagem,
        economia_estimada: built.economia_estimada,
        enviado: false,
      })
      .select('*')
      .single();
    if (aErr) return res.status(500).json({ error: aErr.message });

    return res.status(200).json({
      alert,
      mensagem: built.mensagem,
      economia_estimada: built.economia_estimada,
      whatsapp_url: waUrl,
      telefone_digits: waDigits,
      user: { id: user.id, nome: user.nome, telefone: user.telefone },
    });
  }

  if (req.method === 'PATCH') {
    const alertId = String(req.body?.alert_id || '').trim();
    if (!alertId) return res.status(400).json({ error: 'alert_id obrigatório' });
    const { data, error } = await supabase
      .from('adm_compra_alerts')
      .update({
        enviado: true,
        enviado_em: new Date().toISOString(),
      })
      .eq('id', alertId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ alert: data });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Método não permitido' });
}
