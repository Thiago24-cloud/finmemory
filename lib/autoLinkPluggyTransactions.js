import { findFinMemoryMatchesByAmountAndDate } from './mergeHistoryTimeline';

/**
 * Liga notas (transacoes) sem pluggy_transaction_id a bank_transactions quando há
 * correspondência única por data + valor (mesma regra do histórico unificado).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<{ ok: true; linked: number; details: object[] } | { ok: false; linked: 0; error: string }>}
 */
export async function autoLinkPluggyTransactionsForUser(supabase, userId) {
  if (!userId || typeof userId !== 'string') {
    return { ok: false, linked: 0, error: 'userId inválido' };
  }

  const [{ data: fmRows, error: fmErr }, { data: ofRows, error: ofErr }, { data: claimedRows, error: claimedErr }] =
    await Promise.all([
      supabase
        .from('transacoes')
        .select('id, data, total, pluggy_transaction_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .is('pluggy_transaction_id', null),
      supabase
        .from('bank_transactions')
        .select('pluggy_transaction_id, amount, date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(400),
      // Inclui linhas soft-deleted: o índice único (user_id, pluggy_transaction_id) aplica-se a todas;
      // senão o UPDATE falha com duplicate key quando uma nota apagada ainda retém o id Pluggy.
      supabase
        .from('transacoes')
        .select('pluggy_transaction_id')
        .eq('user_id', userId)
        .not('pluggy_transaction_id', 'is', null),
    ]);

  if (fmErr || ofErr || claimedErr) {
    console.warn('[autoLinkPluggy]', fmErr?.message, ofErr?.message, claimedErr?.message);
    return { ok: false, linked: 0, error: 'Falha ao ler dados para pareamento.' };
  }

  const fmWithoutPluggy = (fmRows || []).filter(
    (r) => r?.pluggy_transaction_id == null || String(r.pluggy_transaction_id).trim() === ''
  );

  const claimedPluggy = new Set(
    (claimedRows || [])
      .map((r) => r?.pluggy_transaction_id)
      .filter((id) => id != null && String(id).trim() !== '')
      .map((id) => String(id))
  );

  const linkedFmIds = new Set();
  let linked = 0;
  const details = [];

  for (const of of ofRows || []) {
    const pid = of?.pluggy_transaction_id;
    if (pid == null || String(pid).trim() === '') continue;
    const pidStr = String(pid);
    if (claimedPluggy.has(pidStr)) continue;

    const pool = fmWithoutPluggy.filter((fm) => !linkedFmIds.has(fm.id));
    const candidates = findFinMemoryMatchesByAmountAndDate(of, pool);
    if (candidates.length !== 1) continue;

    const fm = candidates[0];
    const { error: upErr } = await supabase
      .from('transacoes')
      .update({ pluggy_transaction_id: pidStr })
      .eq('id', fm.id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (upErr) {
      console.warn('[autoLinkPluggy] update', fm.id, upErr.message);
      if (String(upErr.message || '').includes('transacoes_user_pluggy_tx_unique')) {
        claimedPluggy.add(pidStr);
      }
      continue;
    }

    linkedFmIds.add(fm.id);
    claimedPluggy.add(pidStr);
    linked += 1;
    if (details.length < 20) {
      details.push({ transacaoId: fm.id, pluggy_transaction_id: pidStr, date: of.date });
    }
  }

  return { ok: true, linked, details };
}
