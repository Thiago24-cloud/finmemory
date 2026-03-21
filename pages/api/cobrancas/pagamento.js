import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

let supabaseInstance = null;

function getSupabaseAdmin() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

/**
 * POST /api/cobrancas/pagamento
 * Body: { cobranca_id, competencia (YYYY-MM-DD), forma_pagamento?, obs? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Faça login para registrar o pagamento.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta (Supabase).' });
  }

  const { cobranca_id, competencia, forma_pagamento, obs } = req.body || {};
  if (!cobranca_id || !competencia) {
    return res.status(400).json({ success: false, error: 'cobranca_id e competencia são obrigatórios.' });
  }

  const competenciaDate = String(competencia).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(competenciaDate)) {
    return res.status(400).json({ success: false, error: 'Data competência inválida.' });
  }

  try {
    const { data: cob, error: cobErr } = await supabase
      .from('cobrancas')
      .select('id, user_id, titulo, valor, categoria')
      .eq('id', cobranca_id)
      .single();

    if (cobErr || !cob) {
      return res.status(404).json({ success: false, error: 'Cobrança não encontrada.' });
    }
    if (String(cob.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Esta cobrança não é sua.' });
    }

    const todayISO = new Date().toISOString().slice(0, 10);

    const payloadPayment = {
      user_id: userId,
      cobranca_id: cob.id,
      competencia: competenciaDate,
      data_pagamento: todayISO,
      forma_pagamento: forma_pagamento || null,
      obs: obs || null,
    };

    const { error: payErr } = await supabase
      .from('cobrancas_pagamentos')
      .upsert(payloadPayment, { onConflict: 'cobranca_id,competencia' });

    if (payErr) throw payErr;

    const payloadTx = {
      user_id: userId,
      estabelecimento: cob.titulo,
      data: todayISO,
      total: Number(cob.valor) || 0,
      forma_pagamento: forma_pagamento || null,
      categoria: cob.categoria || 'Servicos',
      source: 'cobranca',
      items: [],
    };

    const { error: txErr } = await supabase.from('transacoes').insert(payloadTx);
    if (txErr) throw txErr;

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('[api/cobrancas/pagamento]', e);
    return res.status(500).json({ success: false, error: e?.message || 'Erro ao registrar pagamento' });
  }
}
