import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  aggregateMonthExpenseTotals,
  filterMonthsToLatestYear,
} from '../../../lib/monthExpenseTotals';

/**
 * GET /api/dashboard/month-totals
 * Totais de gastos por mês (DEBIT Open Finance + NF-e/OCR), sem duplicar espelho pluggy em transacoes.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  try {
    const [{ data: bankTransactions, error: bankErr }, { data: transacoes, error: txErr }] =
      await Promise.all([
        supabase
          .from('bank_transactions')
          .select('date, amount, type, category, description')
          .eq('user_id', userId),
        supabase
          .from('transacoes')
          .select('data, total, source, forma_pagamento, categoria, estabelecimento')
          .eq('user_id', userId)
          .is('deleted_at', null),
      ]);

    if (bankErr) console.warn('[month-totals] bank_transactions:', bankErr.message);
    if (txErr) return res.status(500).json({ error: txErr.message });

    const { monthTotals, months: allMonths } = aggregateMonthExpenseTotals({
      bankTransactions: bankTransactions || [],
      transacoes: transacoes || [],
    });

    const months = filterMonthsToLatestYear(allMonths);

    const filteredTotals = {};
    for (const ym of months) {
      if (monthTotals[ym] != null) filteredTotals[ym] = monthTotals[ym];
    }

    return res.status(200).json({
      success: true,
      monthTotals: filteredTotals,
      months,
      meta: {
        bankRows: (bankTransactions || []).length,
        transacaoRows: (transacoes || []).length,
        usesBankDebits: (bankTransactions || []).length > 0,
      },
    });
  } catch (e) {
    console.error('[month-totals]', e);
    return res.status(500).json({ error: e?.message || 'Erro ao calcular totais' });
  }
}
