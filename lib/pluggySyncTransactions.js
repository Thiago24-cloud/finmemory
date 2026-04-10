/**
 * Importa transações Pluggy (Open Finance) para public.transacoes.
 * Usa service role no Supabase (servidor apenas).
 */
import { PluggyClient } from 'pluggy-sdk';
import { pluggyClientId, pluggyClientSecret } from './pluggyEnv';

/** @param {unknown} d */
function toDate(d) {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  if (typeof d === 'string' || typeof d === 'number') {
    const x = new Date(d);
    if (!Number.isNaN(x.getTime())) return x;
  }
  return new Date();
}

/**
 * @param {object} tx transação Pluggy (SDK)
 * @param {string} [accountLabel]
 */
export function mapPluggyTransactionToRow(tx, userId, accountLabel) {
  const dateObj = toDate(tx.date);
  const dataStr = dateObj.toISOString().slice(0, 10);
  const horaStr = dateObj.toTimeString().slice(0, 8);

  const merchant = tx.merchant;
  const nameFromMerchant =
    (merchant && typeof merchant === 'object' && (merchant.name || merchant.businessName)) || '';
  const desc = String(tx.description || tx.descriptionRaw || '').trim();
  const estabelecimento = String(nameFromMerchant || desc || accountLabel || 'Open Finance')
    .trim()
    .slice(0, 500);

  const raw = Number(tx.amount);
  const total = Number.isFinite(raw) ? Math.round(Math.abs(raw) * 100) / 100 : 0;

  const cat = tx.category ? String(tx.category).trim().slice(0, 80) : 'Outros';

  const type = tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT';
  const forma =
    type === 'CREDIT' ? 'Open Finance (entrada)' : 'Open Finance';

  return {
    user_id: userId,
    estabelecimento,
    total,
    data: dataStr,
    hora: horaStr,
    forma_pagamento: forma,
    categoria: cat || 'Outros',
    source: 'pluggy',
    pluggy_transaction_id: tx.id,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {PluggyClient} pluggy
 * @param {string} userId public.users.id
 * @param {string} itemId Pluggy item id
 * @param {{ maxTransactions?: number, daysBack?: number }} [opts]
 */
export async function syncTransactionsForItem(supabase, pluggy, userId, itemId, opts = {}) {
  const maxTransactions = opts.maxTransactions ?? 3000;
  const daysBack = opts.daysBack ?? 120;
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().slice(0, 10);

  const accountsResp = await pluggy.fetchAccounts(itemId);
  const accounts = accountsResp?.results ?? [];
  let processed = 0;
  let inserted = 0;
  let updated = 0;

  for (const acc of accounts) {
    const accountId = acc?.id;
    if (!accountId) continue;
    const accName =
      (acc.name && String(acc.name).slice(0, 80)) ||
      (acc.type && String(acc.type)) ||
      'Conta';

    const txs = await pluggy.fetchAllTransactions(accountId, { from: fromStr });
    const list = Array.isArray(txs) ? txs : [];

    for (const tx of list) {
      if (processed >= maxTransactions) break;
      if (!tx?.id) continue;

      const row = mapPluggyTransactionToRow(tx, userId, accName);

      const { data: existing, error: selErr } = await supabase
        .from('transacoes')
        .select('id')
        .eq('user_id', userId)
        .eq('pluggy_transaction_id', tx.id)
        .maybeSingle();

      if (selErr) {
        console.warn('[pluggySync] select transacao:', selErr.message);
        continue;
      }

      if (existing?.id) {
        const { error: upErr } = await supabase
          .from('transacoes')
          .update({
            estabelecimento: row.estabelecimento,
            total: row.total,
            data: row.data,
            hora: row.hora,
            forma_pagamento: row.forma_pagamento,
            categoria: row.categoria,
          })
          .eq('id', existing.id)
          .eq('user_id', userId);

        if (!upErr) updated += 1;
        else console.warn('[pluggySync] update:', upErr.message);
      } else {
        const insertRow = { ...row };
        const { error: insErr } = await supabase.from('transacoes').insert(insertRow);
        if (!insErr) inserted += 1;
        else if (insErr.code === '23505') {
          // duplicado concorrente
          updated += 1;
        } else {
          console.warn('[pluggySync] insert:', insErr.message);
        }
      }
      processed += 1;
    }
    if (processed >= maxTransactions) break;
  }

  return { processed, inserted, updated, accounts: accounts.length };
}

export function createPluggyServerClient() {
  const clientId = pluggyClientId();
  const clientSecret = pluggyClientSecret();
  if (!clientId || !clientSecret) return null;
  return new PluggyClient({ clientId, clientSecret });
}
