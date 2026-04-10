import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/** Mês civil em America/Sao_Paulo (YYYY-MM-DD início e fim). */
function brazilCurrentMonthRange() {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  if (!y || !m) return { start: null, end: null };
  const mi = parseInt(m, 10);
  const lastDay = new Date(Number(y), mi, 0).getDate();
  const start = `${y}-${m}-01`;
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * GET /api/open-finance/summary
 * Contas com saldo, últimas 50 transações, totais do mês (BRL / datas em SP).
 * Query: ?accountId=<uuid da bank_accounts> — filtra transações recentes por conta.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado ou perfil incompleto.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta (Supabase).' });
  }

  const accountIdFilter =
    typeof req.query.accountId === 'string' && req.query.accountId.trim()
      ? req.query.accountId.trim()
      : null;

  const { data: connections, error: cErr } = await supabase
    .from('bank_connections')
    .select('item_id, status, updated_at')
    .eq('user_id', userId);

  if (cErr) {
    console.warn('[open-finance/summary] bank_connections:', cErr.message);
  }

  const syncing =
    (connections || []).some((row) => {
      const s = row?.status != null ? String(row.status).toUpperCase() : '';
      return s === 'UPDATING' || s === 'SYNCING';
    }) ?? false;

  const { data: accounts, error: aErr } = await supabase
    .from('bank_accounts')
    .select('id, item_id, pluggy_account_id, name, account_type, balance, currency_code, updated_at')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (aErr) {
    console.error('[open-finance/summary] bank_accounts:', aErr.message);
    return res.status(500).json({ error: 'Falha ao ler contas.' });
  }

  let txQuery = supabase
    .from('bank_transactions')
    .select(
      'id, bank_account_id, pluggy_transaction_id, description, amount, date, category, type, status, created_at'
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (accountIdFilter) {
    const allowed = (accounts || []).some((a) => a.id === accountIdFilter);
    if (!allowed) {
      return res.status(400).json({ error: 'Conta inválida ou não pertence ao utilizador.' });
    }
    txQuery = txQuery.eq('bank_account_id', accountIdFilter);
  }

  const { data: recentTransactions, error: tErr } = await txQuery;

  if (tErr) {
    console.error('[open-finance/summary] bank_transactions:', tErr.message);
    return res.status(500).json({ error: 'Falha ao ler transações.' });
  }

  const { start: monthStart, end: monthEnd } = brazilCurrentMonthRange();

  let monthIncome = 0;
  let monthExpense = 0;

  if (monthStart && monthEnd) {
    const { data: monthRows, error: mErr } = await supabase
      .from('bank_transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    if (!mErr && monthRows) {
      for (const row of monthRows) {
        const amt = Math.abs(Number(row.amount) || 0);
        if (row.type === 'CREDIT') monthIncome += amt;
        else monthExpense += amt;
      }
    } else if (mErr) {
      console.warn('[open-finance/summary] month agg:', mErr.message);
    }
  }

  const accountNameById = Object.fromEntries((accounts || []).map((a) => [a.id, a.name || 'Conta']));

  const transactionsWithAccount = (recentTransactions || []).map((t) => ({
    ...t,
    account_name: accountNameById[t.bank_account_id] || null,
  }));

  return res.status(200).json({
    ok: true,
    syncing,
    connections: connections || [],
    accounts: accounts || [],
    recentTransactions: transactionsWithAccount,
    month: {
      start: monthStart,
      end: monthEnd,
      incomeTotal: Math.round(monthIncome * 100) / 100,
      expenseTotal: Math.round(monthExpense * 100) / 100,
    },
  });
}
