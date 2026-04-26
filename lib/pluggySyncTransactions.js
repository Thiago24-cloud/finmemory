/**
 * Importa transações Pluggy (Open Finance) para public.transacoes.
 * Usa service role no Supabase (servidor apenas).
 */
import { PluggyClient } from 'pluggy-sdk';
import { pluggyClientId, pluggyClientSecret } from './pluggyEnv';
import { normalizePluggyMoney } from './pluggyMoney';

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
 * @returns {object | null} null se não houver id Pluggy válido
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

  const raw = normalizePluggyMoney(tx.amount);
  const total = Number.isFinite(raw) ? Math.round(Math.abs(raw) * 100) / 100 : 0;

  const cat = tx.category ? String(tx.category).trim().slice(0, 80) : 'Outros';

  const type = tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT';
  const forma =
    type === 'CREDIT' ? 'Open Finance (entrada)' : 'Open Finance';

  const pluggyId = tx.id != null ? String(tx.id).trim() : '';
  if (!pluggyId) return null;

  return {
    user_id: userId,
    estabelecimento,
    total,
    data: dataStr,
    hora: horaStr,
    forma_pagamento: forma,
    categoria: cat || 'Outros',
    source: 'pluggy',
    pluggy_transaction_id: pluggyId,
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
  /** Linhas aplicadas com upsert (insert ou update via ON CONFLICT) */
  let upserted = 0;

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
      if (!row) continue;

      const { error: upErr } = await supabase.from('transacoes').upsert(row, {
        onConflict: 'user_id,pluggy_transaction_id',
      });

      if (!upErr) upserted += 1;
      else console.warn('[pluggySync] upsert transacao:', upErr.message);
      processed += 1;
    }
    if (processed >= maxTransactions) break;
  }

  await dedupePluggyRowsWithoutExternalId(supabase, userId);

  return {
    processed,
    upserted,
    inserted: upserted,
    updated: 0,
    accounts: accounts.length,
  };
}

export function createPluggyServerClient() {
  const clientId = pluggyClientId();
  const clientSecret = pluggyClientSecret();
  if (!clientId || !clientSecret) return null;
  return new PluggyClient({ clientId, clientSecret });
}

/**
 * Remove duplicatas legadas: source=pluggy sem pluggy_transaction_id, mesmo user,
 * mesma data + hora + valor + estabelecimento (mantém a mais antiga por created_at).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function dedupePluggyRowsWithoutExternalId(supabase, userId) {
  const { data: rows, error } = await supabase
    .from('transacoes')
    .select('id, data, hora, total, estabelecimento, created_at')
    .eq('user_id', userId)
    .eq('source', 'pluggy')
    .is('pluggy_transaction_id', null)
    .order('created_at', { ascending: true });

  if (error || !rows?.length) return;

  const byKey = new Map();
  for (const r of rows) {
    const nome = String(r.estabelecimento || '')
      .trim()
      .toLowerCase();
    const key = `${r.data}|${r.hora}|${Number(r.total)}|${nome}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }

  const toDelete = [];
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    for (let i = 1; i < list.length; i += 1) {
      if (list[i]?.id) toDelete.push(list[i].id);
    }
  }

  const chunk = 80;
  for (let i = 0; i < toDelete.length; i += chunk) {
    const slice = toDelete.slice(i, i + chunk);
    const { error: delErr } = await supabase.from('transacoes').delete().in('id', slice).eq('user_id', userId);
    if (delErr) console.warn('[pluggySync] dedupe sem id:', delErr.message);
  }
}
