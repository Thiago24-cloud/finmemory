import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { gastoCartaoFromDashboardBalance, saldoCartaoComLimiteManual } from '../../../lib/finance/creditCardGasto';
import { isCreditLikeAccount } from '../../../lib/simuladorHintsBalance';

async function resolveUserId(session, supabase) {
  let userId = session?.user?.supabaseId;
  if (userId) return userId;
  const email = session?.user?.email;
  if (!email) return null;
  const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  return data?.id || null;
}

/**
 * GET  /api/simulador/credit-limits — cartões OF + limites salvos
 * PUT  /api/simulador/credit-limits — body { limits: [{ bank_account_id, label?, credit_limit }] }
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email && !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração incompleta' });

  const uid = await resolveUserId(session, supabase);
  if (!uid) return res.status(401).json({ error: 'Utilizador não encontrado' });

  const { data: accounts, error: aErr } = await supabase
    .from('bank_accounts')
    .select('id, name, balance, account_type, currency_code')
    .eq('user_id', uid)
    .order('name', { ascending: true });

  if (aErr) return res.status(500).json({ error: aErr.message });

  const creditAccounts = (accounts || []).filter((a) =>
    isCreditLikeAccount(a.account_type, a.name)
  );

  const { data: saved, error: sErr } = await supabase
    .from('manual_credit_cards')
    .select('id, label, credit_limit, bank_account_id')
    .eq('user_id', uid);

  if (sErr && !String(sErr.message).includes('bank_account_id')) {
    return res.status(500).json({ error: sErr.message });
  }

  const limitByAccountId = {};
  for (const row of saved || []) {
    if (row.bank_account_id && row.credit_limit != null) {
      limitByAccountId[row.bank_account_id] = Number(row.credit_limit);
    }
  }

  const cards = creditAccounts.map((a) => {
    const balance = Number(a.balance) || 0;
    const limite = limitByAccountId[a.id] ?? null;
    const gasto = gastoCartaoFromDashboardBalance(balance);
    const disponivel =
      limite != null && limite > 0 ? saldoCartaoComLimiteManual(limite, balance) : null;

    return {
      bank_account_id: a.id,
      name: (a.name || 'Cartão').trim(),
      balance_dashboard: Math.round(balance * 100) / 100,
      gasto_dashboard: gasto,
      credit_limit: limite,
      disponivel,
    };
  });

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, cards });
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const limits = Array.isArray(body.limits) ? body.limits : [];

    for (const item of limits) {
      const bankAccountId = item?.bank_account_id;
      if (!bankAccountId || typeof bankAccountId !== 'string') continue;

      const acc = creditAccounts.find((a) => a.id === bankAccountId);
      if (!acc) continue;

      const creditLimit =
        item.credit_limit != null && item.credit_limit !== ''
          ? Math.max(0, Number(item.credit_limit))
          : null;

      const label =
        (typeof item.label === 'string' && item.label.trim()) ||
        (acc.name || 'Cartão').trim();

      const { data: existing } = await supabase
        .from('manual_credit_cards')
        .select('id')
        .eq('user_id', uid)
        .eq('bank_account_id', bankAccountId)
        .maybeSingle();

      const row = {
        user_id: uid,
        label: label.slice(0, 200),
        bank_account_id: bankAccountId,
        credit_limit: Number.isFinite(creditLimit) ? creditLimit : null,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await supabase.from('manual_credit_cards').update(row).eq('id', existing.id);
      } else {
        await supabase.from('manual_credit_cards').insert(row);
      }
    }

    return res.status(200).json({ ok: true, saved: limits.length });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
