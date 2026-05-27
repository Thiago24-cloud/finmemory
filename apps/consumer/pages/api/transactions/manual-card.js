import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/**
 * POST /api/transactions/manual-card
 * Body: { manual_credit_card_id, valor, estabelecimento?, data?, categoria? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  const { manual_credit_card_id, valor, estabelecimento, data, categoria } = req.body || {};
  if (!manual_credit_card_id || typeof manual_credit_card_id !== 'string') {
    return res.status(400).json({ error: 'Escolha um cartão.' });
  }

  const { data: card, error: cErr } = await supabase
    .from('manual_credit_cards')
    .select('id')
    .eq('id', manual_credit_card_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (cErr || !card) {
    return res.status(400).json({ error: 'Cartão inválido.' });
  }

  const amount = Number(valor);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Informe um valor maior que zero.' });
  }

  const merchant = String(estabelecimento || 'Compra no cartão').trim().slice(0, 200);
  let dataStr = typeof data === 'string' ? data.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    dataStr = new Date().toISOString().slice(0, 10);
  }

  const cat = String(categoria || 'Outros').trim().slice(0, 80) || 'Outros';

  const insert = {
    user_id: userId,
    estabelecimento: merchant,
    total: Math.round(amount * 100) / 100,
    data: dataStr,
    forma_pagamento: 'Cartão de crédito',
    categoria: cat,
    source: 'manual_card',
    manual_credit_card_id: manual_credit_card_id,
    updated_at: new Date().toISOString(),
  };

  const { data: tx, error: insErr } = await supabase.from('transacoes').insert(insert).select().single();

  if (insErr) {
    console.error('[manual-card POST]', insErr);
    return res.status(500).json({ error: insErr.message });
  }

  return res.status(201).json({ transaction: tx });
}
