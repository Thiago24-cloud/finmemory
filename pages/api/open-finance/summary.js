import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { createPluggyServerClient } from '../../../lib/pluggySyncTransactions';

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

function cleanHexColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(normalized)) return null;
  return normalized.toUpperCase();
}

function pickConnectorMeta(item) {
  const connector = item?.connector || item?.institution || null;
  const id = connector?.id != null ? String(connector.id) : null;
  const name =
    connector?.name != null
      ? String(connector.name).trim() || null
      : connector?.institutionName != null
        ? String(connector.institutionName).trim() || null
        : null;
  const imageUrl =
    connector?.imageUrl != null
      ? String(connector.imageUrl).trim() || null
      : connector?.logoUrl != null
        ? String(connector.logoUrl).trim() || null
        : null;
  const primaryColor = cleanHexColor(
    connector?.primaryColor || connector?.color || connector?.brandColor || null
  );
  return { id, name, imageUrl, primaryColor };
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

  let accountsFiltered = accounts || [];
  if (!cErr) {
    const activeItemIds = new Set(
      (connections || []).map((c) => c?.item_id).filter((id) => typeof id === 'string' && id.trim())
    );
    accountsFiltered = accountsFiltered.filter((a) => activeItemIds.has(a.item_id));
  }

  const nameCounts = accountsFiltered.reduce((acc, a) => {
    const key = (a.name || 'Conta').trim() || 'Conta';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  accountsFiltered = accountsFiltered.map((a) => {
    const base = (a.name || 'Conta').trim() || 'Conta';
    const dup = (nameCounts[base] || 0) > 1;
    const suffix =
      dup && typeof a.item_id === 'string' && a.item_id.length >= 6
        ? a.item_id.slice(-6)
        : null;
    return {
      ...a,
      display_name: suffix ? `${base} · …${suffix}` : base,
    };
  });

  const itemIds = Array.from(
    new Set(
      accountsFiltered
        .map((a) => (typeof a?.item_id === 'string' ? a.item_id.trim() : ''))
        .filter(Boolean)
    )
  );
  const connectorByItemId = {};
  const pluggy = createPluggyServerClient();
  if (pluggy && itemIds.length > 0) {
    await Promise.all(
      itemIds.map(async (itemId) => {
        try {
          const item = await pluggy.fetchItem(itemId);
          const meta = pickConnectorMeta(item);
          connectorByItemId[itemId] = meta;
        } catch (err) {
          console.warn('[open-finance/summary] fetchItem:', itemId, err?.message || err);
        }
      })
    );
  }

  accountsFiltered = accountsFiltered.map((a) => {
    const meta = connectorByItemId[a.item_id] || {};
    return {
      ...a,
      connector_id: meta.id || null,
      connector_name: meta.name || null,
      connector_image_url: meta.imageUrl || null,
      connector_primary_color: meta.primaryColor || null,
    };
  });

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
    const allowed = accountsFiltered.some((a) => a.id === accountIdFilter);
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
    let monthQ = supabase
      .from('bank_transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    if (accountIdFilter) {
      const allowedMonth = accountsFiltered.some((a) => a.id === accountIdFilter);
      if (allowedMonth) {
        monthQ = monthQ.eq('bank_account_id', accountIdFilter);
      }
    }

    const { data: monthRows, error: mErr } = await monthQ;

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

  const accountNameById = Object.fromEntries(
    accountsFiltered.map((a) => [a.id, a.display_name || a.name || 'Conta'])
  );

  const transactionsWithAccount = (recentTransactions || []).map((t) => ({
    ...t,
    account_name: accountNameById[t.bank_account_id] || null,
  }));

  return res.status(200).json({
    ok: true,
    syncing,
    connections: connections || [],
    accounts: accountsFiltered,
    recentTransactions: transactionsWithAccount,
    month: {
      start: monthStart,
      end: monthEnd,
      incomeTotal: Math.round(monthIncome * 100) / 100,
      expenseTotal: Math.round(monthExpense * 100) / 100,
    },
  });
}
