/**
 * Espelha contas e transações Pluggy em bank_accounts / bank_transactions.
 * Usar apenas no servidor com Supabase service role.
 */

/** @param {unknown} d */
function toDateOnly(d) {
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  if (typeof d === 'string' || typeof d === 'number') {
    const x = new Date(d);
    if (!Number.isNaN(x.getTime())) return x.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('pluggy-sdk').PluggyClient} pluggy
 * @param {string} userId
 * @param {string} itemId
 * @param {{ maxTransactions?: number, daysBack?: number }} [opts]
 */
export async function syncOpenFinanceForItem(supabase, pluggy, userId, itemId, opts = {}) {
  const maxTransactions = opts.maxTransactions ?? 3000;
  const daysBack = opts.daysBack ?? 120;
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const accountsResp = await pluggy.fetchAccounts(itemId);
  const accounts = accountsResp?.results ?? [];

  let accountsUpserted = 0;
  let txProcessed = 0;
  let txUpserted = 0;

  /** @type {Map<string, string>} pluggy_account_id -> bank_accounts.id */
  const accountIdByPluggy = new Map();

  for (const acc of accounts) {
    const pluggyAccountId =
      acc?.id != null && String(acc.id).trim() !== '' ? String(acc.id).trim() : null;
    if (!pluggyAccountId) continue;

    const name =
      (acc.name && String(acc.name).trim().slice(0, 200)) ||
      (acc.marketingName && String(acc.marketingName).trim().slice(0, 200)) ||
      'Conta';
    const accountType = [acc.type, acc.subtype].filter(Boolean).join(' / ').slice(0, 120) || null;
    const balance = Number(acc.balance);
    const currencyCode = acc.currencyCode != null ? String(acc.currencyCode).slice(0, 8) : 'BRL';

    const row = {
      user_id: userId,
      item_id: itemId,
      pluggy_account_id: pluggyAccountId,
      name,
      account_type: accountType,
      balance: Number.isFinite(balance) ? balance : null,
      currency_code: currencyCode,
      updated_at: nowIso,
    };

    const { error: upAccErr } = await supabase
      .from('bank_accounts')
      .upsert(row, { onConflict: 'user_id,pluggy_account_id' });

    if (upAccErr) {
      console.warn('[pluggySyncOpenFinance] upsert bank_accounts:', upAccErr.message);
      continue;
    }
    accountsUpserted += 1;
  }

  const { data: accountRows } = await supabase
    .from('bank_accounts')
    .select('id, pluggy_account_id')
    .eq('user_id', userId)
    .eq('item_id', itemId);

  for (const r of accountRows || []) {
    const pid = r?.pluggy_account_id != null ? String(r.pluggy_account_id).trim() : '';
    if (pid && r?.id) accountIdByPluggy.set(pid, r.id);
  }

  for (const acc of accounts) {
    const pluggyAccountId =
      acc?.id != null && String(acc.id).trim() !== '' ? String(acc.id).trim() : null;
    if (!pluggyAccountId) continue;
    const bankAccountId = accountIdByPluggy.get(pluggyAccountId);
    if (!bankAccountId) continue;

    const txs = await pluggy.fetchAllTransactions(pluggyAccountId, { from: fromStr });
    const list = Array.isArray(txs) ? txs : [];

    for (const tx of list) {
      if (txProcessed >= maxTransactions) break;
      const pluggyTxId = tx?.id != null && String(tx.id).trim() !== '' ? String(tx.id).trim() : null;
      if (!pluggyTxId) continue;

      const amount = Number(tx.amount);
      const type = tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT';
      const status = tx.status != null ? String(tx.status) : 'POSTED';
      const desc = String(tx.description || tx.descriptionRaw || '').trim().slice(0, 2000) || null;
      const category = tx.category != null ? String(tx.category).trim().slice(0, 200) : null;

      const txRow = {
        user_id: userId,
        bank_account_id: bankAccountId,
        pluggy_transaction_id: pluggyTxId,
        description: desc,
        amount: Number.isFinite(amount) ? amount : 0,
        date: toDateOnly(tx.date),
        category,
        type,
        status,
      };

      const { error: txErr } = await supabase.from('bank_transactions').upsert(txRow, {
        onConflict: 'user_id,pluggy_transaction_id',
      });

      if (!txErr) txUpserted += 1;
      else if (txErr.code !== '23505') {
        console.warn('[pluggySyncOpenFinance] upsert bank_transactions:', txErr.message);
      }
      txProcessed += 1;
    }
    if (txProcessed >= maxTransactions) break;
  }

  return {
    accountsUpserted,
    accountsTotal: accounts.length,
    transactionsProcessed: txProcessed,
    transactionsUpserted: txUpserted,
  };
}
