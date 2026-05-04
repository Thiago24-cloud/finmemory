import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { computePurchasingPowerHint, isCreditLikeAccount } from '../../../lib/simuladorHintsBalance';

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

function dayOfMonthFromIsoDate(iso) {
  const m = String(iso || '').match(/^\d{4}-\d{2}-(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function safeAbsNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function monthKeyFromIso(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * GET /api/simulador/hints
 * Sugestões a partir de Open Finance (contas, mês atual, crédito manual) e histórico de créditos.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const { data: connections, error: cErr } = await supabase
    .from('bank_connections')
    .select('item_id, status')
    .eq('user_id', userId);

  if (cErr) {
    console.warn('[simulador/hints] bank_connections:', cErr.message);
  }

  const { data: accountsRaw, error: aErr } = await supabase
    .from('bank_accounts')
    .select('id, item_id, name, balance, currency_code, account_type')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (aErr) {
    console.error('[simulador/hints] bank_accounts:', aErr.message);
    return res.status(500).json({ error: 'Falha ao ler contas.' });
  }

  let accounts = accountsRaw || [];
  if (!cErr && connections?.length) {
    const activeItemIds = new Set(
      connections.map((c) => c?.item_id).filter((id) => typeof id === 'string' && id.trim())
    );
    accounts = accounts.filter((a) => activeItemIds.has(a.item_id));
  }

  const { data: cardsEarly, error: cardEarlyErr } = await supabase
    .from('manual_credit_cards')
    .select('id, label, due_day, closing_day, credit_limit')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(8);

  if (cardEarlyErr) {
    console.warn('[simulador/hints] manual_credit_cards (early):', cardEarlyErr.message);
  }

  const manualCards = (cardsEarly || []).map((c) => ({
    id: c.id,
    label: c.label,
    due_day: c.due_day,
    closing_day: c.closing_day,
    credit_limit: c.credit_limit != null ? Number(c.credit_limit) : null,
  }));

  const accountsForHint = accounts.map((a) => ({
    balance: a.balance,
    account_type: a.account_type,
    name: a.name,
  }));

  const creditSorted = [...accountsForHint]
    .filter((a) => isCreditLikeAccount(a.account_type, a.name))
    .sort((a, b) =>
      String(a.name || '')
        .trim()
        .toLowerCase()
        .localeCompare(String(b.name || '').trim().toLowerCase(), 'pt-BR')
    );
  /** Mesma ordem A→Z que contas de crédito OF — n-ésimo limite ↔ n-ésimo cartão manual. */
  const manualCardsForPairing = [...manualCards].sort((a, b) =>
    String(a.label || a.id || '')
      .trim()
      .toLowerCase()
      .localeCompare(String(b.label || b.id || '').trim().toLowerCase(), 'pt-BR')
  );
  const manualLimitsOrdered = creditSorted.map((_, i) =>
    manualCardsForPairing[i]?.credit_limit != null ? Number(manualCardsForPairing[i].credit_limit) : null
  );

  const balanceHints = computePurchasingPowerHint(accountsForHint, manualLimitsOrdered);
  /** Poder de compra: Σ(débito) + Σ(crédito disponível); crédito com limite manual usa limite − fatura implícita no saldo. */
  const accountBalanceTotal = balanceHints.purchasingPower;

  const accountsOut = accounts.map((a) => {
    const bal = Number(a.balance) || 0;
    const credit = isCreditLikeAccount(a.account_type, a.name);
    return {
      id: a.id,
      name: (a.name || 'Conta').trim() || 'Conta',
      balance: Math.round(bal * 100) / 100,
      currency_code: a.currency_code || 'BRL',
      account_type: a.account_type || null,
      kind: credit ? 'credit' : 'checking_like',
    };
  });

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
      console.warn('[simulador/hints] month agg:', mErr.message);
    }
  }

  monthIncome = Math.round(monthIncome * 100) / 100;
  monthExpense = Math.round(monthExpense * 100) / 100;

  const since = isoDateDaysAgo(120);
  const { data: creditRows, error: crErr } = await supabase
    .from('bank_transactions')
    .select('amount, date, type')
    .eq('user_id', userId)
    .eq('type', 'CREDIT')
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(400);

  let salaryDayHint = null;
  if (!crErr && creditRows?.length) {
    const threshold = Math.max(400, monthIncome * 0.25 || 0);
    const weightByDom = new Map();
    for (const row of creditRows) {
      const amt = Math.abs(Number(row.amount) || 0);
      if (amt < threshold) continue;
      const dom = dayOfMonthFromIsoDate(row.date);
      if (dom == null) continue;
      weightByDom.set(dom, (weightByDom.get(dom) || 0) + amt);
    }
    let bestDom = null;
    let bestW = 0;
    for (const [dom, w] of weightByDom) {
      if (w > bestW) {
        bestW = w;
        bestDom = dom;
      }
    }
    salaryDayHint = bestDom;
  }

  const daysInMonth = monthStart
    ? new Date(
        parseInt(monthStart.slice(0, 4), 10),
        parseInt(monthStart.slice(5, 7), 10),
        0
      ).getDate()
    : 30;

  const dailyBurnHint =
    daysInMonth > 0 ? Math.max(0, Math.round((monthExpense / daysInMonth) * 100) / 100) : 0;

  const since28 = isoDateDaysAgo(28);
  let openFinanceDebits28d = 0;
  let ocrManualDebits28d = 0;

  const { data: bankTx28d, error: bankTxErr } = await supabase
    .from('bank_transactions')
    .select('amount, type, date, description, category')
    .eq('user_id', userId)
    .gte('date', since28)
    .order('date', { ascending: false })
    .limit(1200);

  /** @type {Array<{ date: string, amount: number, description: string, source: string }>} */
  const auditOpenFinanceLines = [];

  if (bankTxErr) {
    console.warn('[simulador/hints] bank_transactions 28d:', bankTxErr.message);
  } else if (Array.isArray(bankTx28d)) {
    for (const row of bankTx28d) {
      const type = String(row?.type || '').toUpperCase();
      const amount = Number(row?.amount || 0);
      const isDebitByType = type === 'DEBIT' || type === 'EXPENSE';
      const isDebitBySignal = !Number.isNaN(amount) && amount < 0;
      if (isDebitByType || isDebitBySignal) {
        const absAmt = safeAbsNumber(amount);
        openFinanceDebits28d += absAmt;
        if (auditOpenFinanceLines.length < 90) {
          const d = String(row?.date || '').slice(0, 10);
          const desc = String(row?.description || row?.category || 'Movimento Open Finance').trim().slice(0, 120);
          auditOpenFinanceLines.push({
            date: d || since28,
            amount: Math.round(absAmt * 100) / 100,
            description: desc || 'Movimento Open Finance',
            source: 'open_finance',
          });
        }
      }
    }
  }

  const { data: localTx28d, error: localTxErr } = await supabase
    .from('transacoes')
    .select('total, source, data, created_at, estabelecimento')
    .eq('user_id', userId)
    .in('source', ['receipt_ocr', 'manual'])
    .gte('data', since28)
    .order('data', { ascending: false })
    .limit(1200);

  /** @type {Array<{ date: string, amount: number, description: string, source: string }>} */
  const auditOcrLines = [];

  if (localTxErr) {
    console.warn('[simulador/hints] transacoes 28d:', localTxErr.message);
  } else if (Array.isArray(localTx28d)) {
    for (const row of localTx28d) {
      const absAmt = safeAbsNumber(row?.total);
      ocrManualDebits28d += absAmt;
      if (auditOcrLines.length < 60) {
        const d = String(row?.data || '').slice(0, 10);
        const desc = String(row?.estabelecimento || 'Nota / manual').trim().slice(0, 120);
        auditOcrLines.push({
          date: d || since28,
          amount: Math.round(absAmt * 100) / 100,
          description: desc || 'Nota / manual',
          source: 'ocr_manual',
        });
      }
    }
  }

  const totalDebits28d = openFinanceDebits28d + ocrManualDebits28d;
  const dailyBurnReal28d = Math.round((totalDebits28d / 28) * 100) / 100;

  const auditMerged = [...auditOpenFinanceLines, ...auditOcrLines]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 55);

  const dailyBurnAudit = {
    windowDays: 28,
    numeratorTotal: Math.round(totalDebits28d * 100) / 100,
    divisor: 28,
    formula: 'Σ gastos elegíveis (últimos 28 dias) ÷ 28',
    openFinanceDebits28d: Math.round(openFinanceDebits28d * 100) / 100,
    ocrManualDebits28d: Math.round(ocrManualDebits28d * 100) / 100,
    lines: auditMerged,
  };

  const since90 = isoDateDaysAgo(95);
  const { data: bankTx90d, error: bank90Err } = await supabase
    .from('bank_transactions')
    .select('amount, type, date')
    .eq('user_id', userId)
    .gte('date', since90)
    .order('date', { ascending: false })
    .limit(3000);
  const monthlyDebits = new Map();
  if (bank90Err) {
    console.warn('[simulador/hints] bank_transactions 90d:', bank90Err.message);
  } else if (Array.isArray(bankTx90d)) {
    for (const row of bankTx90d) {
      const type = String(row?.type || '').toUpperCase();
      const amount = Number(row?.amount || 0);
      const isDebitByType = type === 'DEBIT' || type === 'EXPENSE';
      const isDebitBySignal = !Number.isNaN(amount) && amount < 0;
      if (!(isDebitByType || isDebitBySignal)) continue;
      const monthKey = monthKeyFromIso(row?.date);
      if (!monthKey) continue;
      monthlyDebits.set(monthKey, (monthlyDebits.get(monthKey) || 0) + safeAbsNumber(amount));
    }
  }
  const last3 = [...monthlyDebits.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 3)
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
  const avgExpenseLast3Months =
    last3.length > 0 ? Math.round((last3.reduce((acc, x) => acc + x.total, 0) / last3.length) * 100) / 100 : 0;

  return res.status(200).json({
    ok: true,
    accountBalanceTotal: Math.round(accountBalanceTotal * 100) / 100,
    startingBalanceBreakdown: {
      naiveSumAllAccounts: balanceHints.naiveSumAllAccounts,
      debitAccountsSum: balanceHints.debitAccountsSum,
      creditAvailableSum: balanceHints.creditAvailableSum,
      purchasingPower: balanceHints.purchasingPower,
      conservativeNet: balanceHints.conservativeNet,
      perAccount: balanceHints.perAccount,
    },
    accounts: accountsOut,
    month: {
      start: monthStart,
      end: monthEnd,
      incomeTotal: monthIncome,
      expenseTotal: monthExpense,
    },
    salaryDayHint,
    dailyBurnHint,
    dailyBurnReal28d,
    dailyBurnAudit,
    burnRateBreakdown: {
      windowDays: 28,
      totalDebits: Math.round(totalDebits28d * 100) / 100,
      openFinanceDebits: Math.round(openFinanceDebits28d * 100) / 100,
      ocrManualDebits: Math.round(ocrManualDebits28d * 100) / 100,
    },
    baseline: {
      avgExpenseLast3Months,
      monthlyDebitsLast3Months: last3,
    },
    manualCards,
    hasOpenFinance: accountsOut.length > 0,
  });
}
