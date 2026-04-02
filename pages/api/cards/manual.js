import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { parseMoneyInput } from '../../../lib/parseMoneyInput';

function monthRange(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    const d = new Date();
    ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${ym}-01`,
    end: `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * GET  /api/cards/manual?month=YYYY-MM — lista cartões + gasto no mês (opcional)
 * POST /api/cards/manual — cria cartão manual
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login para gerir cartões.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  if (req.method === 'GET') {
    const month = typeof req.query.month === 'string' ? req.query.month : null;
    const { data: cards, error } = await supabase
      .from('manual_credit_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[cards/manual GET]', error);
      return res.status(500).json({
        error: error.message,
        hint: 'Execute a migração manual_credit_cards no Supabase se a tabela não existir.',
      });
    }

    const list = Array.isArray(cards) ? cards : [];
    const spend = {};
    if (month) {
      const { start, end } = monthRange(month);
      const { data: rows } = await supabase
        .from('transacoes')
        .select('manual_credit_card_id, total')
        .eq('user_id', userId)
        .gte('data', start)
        .lte('data', end)
        .not('manual_credit_card_id', 'is', null)
        .is('deleted_at', null);
      for (const row of rows || []) {
        const cid = row.manual_credit_card_id;
        if (!cid) continue;
        spend[cid] = (spend[cid] || 0) + Number(row.total || 0);
      }
    }

    return res.status(200).json({
      cards: list.map((c) => ({
        ...c,
        spent_month: month ? spend[c.id] || 0 : null,
      })),
    });
  }

  if (req.method === 'POST') {
    const { label, last4, credit_limit, closing_day, due_day } = req.body || {};
    const name = String(label || '').trim();
    if (!name || name.length > 80) {
      return res.status(400).json({ error: 'Informe um nome para o cartão (ex.: Nubank).' });
    }
    const last = last4 != null && String(last4).trim() !== '' ? String(last4).replace(/\D/g, '').slice(0, 4) : null;
    if (last && last.length !== 4) {
      return res.status(400).json({ error: 'Últimos 4 dígitos: informe 4 números ou deixe em branco.' });
    }
    const limitNum =
      credit_limit === '' || credit_limit === undefined || credit_limit === null
        ? null
        : parseMoneyInput(credit_limit);
    if (limitNum != null && (Number.isNaN(limitNum) || limitNum < 0)) {
      return res.status(400).json({ error: 'Limite inválido.' });
    }
    const cd = closing_day != null && closing_day !== '' ? parseInt(String(closing_day), 10) : null;
    const dd = due_day != null && due_day !== '' ? parseInt(String(due_day), 10) : null;
    if (cd != null && (cd < 1 || cd > 31)) return res.status(400).json({ error: 'Dia de fechamento entre 1 e 31.' });
    if (dd != null && (dd < 1 || dd > 31)) return res.status(400).json({ error: 'Dia de vencimento entre 1 e 31.' });

    const { data: row, error: insErr } = await supabase
      .from('manual_credit_cards')
      .insert({
        user_id: userId,
        label: name,
        last4: last,
        credit_limit: limitNum,
        closing_day: cd,
        due_day: dd,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insErr) {
      console.error('[cards/manual POST]', insErr);
      return res.status(500).json({ error: insErr.message });
    }
    return res.status(201).json({ card: row });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
