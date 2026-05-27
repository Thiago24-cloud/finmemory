import { findFinMemoryMatchesByAmountAndDate } from './mergeHistoryTimeline';

const PAGE = 1000;

/** IDs Pluggy como texto único (Postgres UNIQUE em texto é case-sensitive). */
function canonicalPluggyId(v) {
  const s = String(v ?? '').trim();
  return s ? s.toLowerCase() : '';
}

/**
 * PostgREST limita ~1000 linhas por pedido; sem paginação o Set de ids “já usados” ficava
 * incompleto e o UPDATE gerava duplicate key em transacoes_user_pluggy_tx_unique.
 */
async function fetchAllClaimedPluggyIds(supabase, userId) {
  const claimed = new Set();
  let offset = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from('transacoes')
      .select('pluggy_transaction_id')
      .eq('user_id', userId)
      .not('pluggy_transaction_id', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) return { error, claimed: null };
    const batch = rows || [];
    for (const r of batch) {
      const id = canonicalPluggyId(r?.pluggy_transaction_id);
      if (id) claimed.add(id);
    }
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return { error: null, claimed };
}

async function fetchAllFmWithoutPluggy(supabase, userId) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from('transacoes')
      .select('id, data, total, pluggy_transaction_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('pluggy_transaction_id', null)
      .range(offset, offset + PAGE - 1);

    if (error) return { error, rows: null };
    const batch = rows || [];
    out.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return { error: null, rows: out };
}

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

  const [fmResult, { data: ofRows, error: ofErr }, claimedResult] = await Promise.all([
    fetchAllFmWithoutPluggy(supabase, userId),
    supabase
      .from('bank_transactions')
      .select('pluggy_transaction_id, amount, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(400),
    fetchAllClaimedPluggyIds(supabase, userId),
  ]);

  const fmErr = fmResult.error;
  const fmRows = fmResult.rows;
  const claimedErr = claimedResult.error;
  const claimedPluggy = claimedResult.claimed;

  if (fmErr || ofErr || claimedErr || !claimedPluggy || !fmRows) {
    console.warn('[autoLinkPluggy]', fmErr?.message, ofErr?.message, claimedErr?.message);
    return { ok: false, linked: 0, error: 'Falha ao ler dados para pareamento.' };
  }

  const fmWithoutPluggy = fmRows.filter(
    (r) => r?.pluggy_transaction_id == null || String(r.pluggy_transaction_id).trim() === ''
  );

  const linkedFmIds = new Set();
  let linked = 0;
  const details = [];

  for (const of of ofRows || []) {
    const pid = of?.pluggy_transaction_id;
    if (pid == null || String(pid).trim() === '') continue;
    const pidStr = canonicalPluggyId(pid);
    if (!pidStr || claimedPluggy.has(pidStr)) continue;

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
      if (String(upErr.message || '').includes('transacoes_user_pluggy_tx_unique')) {
        claimedPluggy.add(pidStr);
        continue;
      }
      console.warn('[autoLinkPluggy] update', fm.id, upErr.message);
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
