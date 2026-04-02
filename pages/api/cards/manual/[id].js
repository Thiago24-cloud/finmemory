import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { parseMoneyInput } from '../../../../lib/parseMoneyInput';

/**
 * PATCH /api/cards/manual/[id] — atualiza cartão
 * DELETE /api/cards/manual/[id] — remove cartão (transações ficam, card_id vira null)
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'ID inválido.' });

  const { data: existing, error: exErr } = await supabase
    .from('manual_credit_cards')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (exErr || !existing) {
    return res.status(404).json({ error: 'Cartão não encontrado.' });
  }

  if (req.method === 'PATCH') {
    const { label, last4, credit_limit, closing_day, due_day } = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (label !== undefined) {
      const name = String(label).trim();
      if (!name) return res.status(400).json({ error: 'Nome não pode ser vazio.' });
      patch.label = name.slice(0, 80);
    }
    if (last4 !== undefined) {
      const last = String(last4).replace(/\D/g, '').slice(0, 4);
      if (last.length === 0) patch.last4 = null;
      else if (last.length === 4) patch.last4 = last;
      else return res.status(400).json({ error: 'Últimos 4 dígitos: 4 números ou vazio.' });
    }
    if (credit_limit !== undefined) {
      if (credit_limit === '' || credit_limit === null) patch.credit_limit = null;
      else {
        const n = parseMoneyInput(credit_limit);
        if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: 'Limite inválido.' });
        patch.credit_limit = n;
      }
    }
    if (closing_day !== undefined) {
      if (closing_day === '' || closing_day === null) patch.closing_day = null;
      else {
        const d = parseInt(String(closing_day), 10);
        if (d < 1 || d > 31) return res.status(400).json({ error: 'Dia de fechamento 1–31.' });
        patch.closing_day = d;
      }
    }
    if (due_day !== undefined) {
      if (due_day === '' || due_day === null) patch.due_day = null;
      else {
        const d = parseInt(String(due_day), 10);
        if (d < 1 || d > 31) return res.status(400).json({ error: 'Dia de vencimento 1–31.' });
        patch.due_day = d;
      }
    }

    const { data: row, error } = await supabase
      .from('manual_credit_cards')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ card: row });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('manual_credit_cards').delete().eq('id', id).eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
