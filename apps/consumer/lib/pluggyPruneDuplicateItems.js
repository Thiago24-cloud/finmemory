/** @param {unknown} e */
function isPluggyItemNotFoundError(e) {
  if (!e || typeof e !== 'object') return false;
  const msg = String((/** @type {any} */ (e)).message || '').toUpperCase();
  const code = String((/** @type {any} */ (e)).code || '');
  const status =
    (/** @type {any} */ (e)).status ??
    (/** @type {any} */ (e)).response?.status ??
    (/** @type {any} */ (e)).statusCode;
  if (status === 404) return true;
  if (code === '404' || code === 'ITEM_NOT_FOUND') return true;
  if (msg.includes('404') || msg.includes('ITEM_NOT_FOUND') || msg.includes('NOT FOUND')) return true;
  return false;
}

/**
 * Preenche pluggy_connector_id onde está NULL (fetchItem por item) e remove conexões mortas na Pluggy (404).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('pluggy-sdk').PluggyClient} pluggy
 * @param {string} userId
 */
async function backfillBankConnectionConnectorIds(supabase, pluggy, userId) {
  const { data: rows, error } = await supabase
    .from('bank_connections')
    .select('item_id, pluggy_connector_id')
    .eq('user_id', userId);

  if (error) {
    console.warn('[pluggyPrune] backfill select:', error.message);
    return;
  }

  for (const row of rows || []) {
    const oid = row?.item_id;
    if (!oid || typeof oid !== 'string') continue;

    if (row.pluggy_connector_id != null) continue;

    try {
      const oitem = await pluggy.fetchItem(oid);
      const raw = oitem?.connector?.id;
      const n = raw != null ? Number(raw) : NaN;
      if (Number.isFinite(n)) {
        await supabase
          .from('bank_connections')
          .update({ pluggy_connector_id: n, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('item_id', oid);
      }
    } catch (e) {
      if (isPluggyItemNotFoundError(e)) {
        await supabase.from('bank_accounts').delete().eq('user_id', userId).eq('item_id', oid);
        await supabase.from('bank_connections').delete().eq('user_id', userId).eq('item_id', oid);
      }
    }
  }
}

/**
 * Obtém connector.id do item, remove outros items do mesmo connector e devolve o id para gravar em bank_connections.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('pluggy-sdk').PluggyClient} pluggy
 * @param {string} userId
 * @param {string} itemId
 * @returns {Promise<{ pluggyConnectorId: number | null }>}
 */
export async function refreshConnectorAndPruneDuplicates(supabase, pluggy, userId, itemId) {
  let pluggyConnectorId = null;
  try {
    await backfillBankConnectionConnectorIds(supabase, pluggy, userId);
    const item = await pluggy.fetchItem(itemId);
    const raw = item?.connector?.id;
    const n = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(n)) {
      pluggyConnectorId = n;
      await pruneOtherBankConnectionsSameConnector(supabase, pluggy, userId, itemId, n);
    }
  } catch (e) {
    console.warn('[pluggyPrune] fetchItem:', e?.message || e);
  }
  await pruneOrphanBankAccountsForUser(supabase, userId);
  return { pluggyConnectorId };
}

/**
 * Apaga linhas em bank_accounts cujo item_id já não tem bank_connections (inconsistência / item removido).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function pruneOrphanBankAccountsForUser(supabase, userId) {
  const { data: conns, error: cErr } = await supabase
    .from('bank_connections')
    .select('item_id')
    .eq('user_id', userId);
  if (cErr) {
    console.warn('[pluggyPrune] orphan: bank_connections:', cErr.message);
    return;
  }
  const keep = new Set(
    (conns || []).map((c) => c?.item_id).filter((id) => typeof id === 'string' && id.trim())
  );
  const { data: rows, error: aErr } = await supabase
    .from('bank_accounts')
    .select('item_id')
    .eq('user_id', userId);
  if (aErr) {
    console.warn('[pluggyPrune] orphan: bank_accounts:', aErr.message);
    return;
  }
  const orphanItemIds = [
    ...new Set(
      (rows || [])
        .map((r) => r?.item_id)
        .filter((id) => typeof id === 'string' && id.trim() && !keep.has(id))
    ),
  ];
  if (orphanItemIds.length === 0) return;
  const { error: dErr } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('user_id', userId)
    .in('item_id', orphanItemIds);
  if (dErr) console.warn('[pluggyPrune] orphan delete:', dErr.message);
}

/**
 * Remove outros items Pluggy do mesmo utilizador e mesma instituição (connector.id),
 * evitando várias cópias de contas após reconectar o mesmo banco.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('pluggy-sdk').PluggyClient} pluggy
 * @param {string} userId
 * @param {string} keepItemId item Pluggy a manter
 * @param {number} connectorId Pluggy item.connector.id do item a manter
 */
export async function pruneOtherBankConnectionsSameConnector(
  supabase,
  pluggy,
  userId,
  keepItemId,
  connectorId
) {
  const num = Number(connectorId);
  if (!Number.isFinite(num)) return { prunedItemIds: [] };

  const { data: others, error: selErr } = await supabase
    .from('bank_connections')
    .select('item_id, pluggy_connector_id')
    .eq('user_id', userId)
    .neq('item_id', keepItemId);

  if (selErr) {
    console.warn('[pluggyPrune] select bank_connections:', selErr.message);
    return { prunedItemIds: [], error: selErr.message };
  }

  const toPrune = [];
  for (const row of others || []) {
    const oid = row?.item_id;
    if (!oid || typeof oid !== 'string') continue;
    const stored = row.pluggy_connector_id;
    if (stored != null && Number(stored) === num) {
      toPrune.push(oid);
      continue;
    }
    if (stored == null) {
      try {
        const oitem = await pluggy.fetchItem(oid);
        if (oitem?.connector?.id != null && Number(oitem.connector.id) === num) {
          toPrune.push(oid);
        }
      } catch (e) {
        if (isPluggyItemNotFoundError(e)) {
          toPrune.push(oid);
        }
      }
    }
  }

  if (toPrune.length === 0) return { prunedItemIds: [] };

  const { error: aErr } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('user_id', userId)
    .in('item_id', toPrune);
  if (aErr) console.warn('[pluggyPrune] delete bank_accounts:', aErr.message);

  const { error: cErr } = await supabase
    .from('bank_connections')
    .delete()
    .eq('user_id', userId)
    .in('item_id', toPrune);
  if (cErr) console.warn('[pluggyPrune] delete bank_connections:', cErr.message);

  return { prunedItemIds: toPrune };
}
