import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { createPluggyServerClient, syncTransactionsForItem } from '../../../lib/pluggySyncTransactions';
import { syncOpenFinanceForItem } from '../../../lib/pluggySyncOpenFinance';
import { refreshConnectorAndPruneDuplicates } from '../../../lib/pluggyPruneDuplicateItems';
import { autoLinkPluggyTransactionsForUser } from '../../../lib/autoLinkPluggyTransactions';

/**
 * POST /api/pluggy/sync-transactions
 * Body: { itemId: string }
 * Importa transações Pluggy (últimos ~120 dias) para public.transacoes.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado ou perfil incompleto.' });
  }

  const { itemId } = req.body || {};
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId é obrigatório' });
  }

  const trimmed = itemId.trim();
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta (Supabase).' });
  }

  const pluggy = createPluggyServerClient();
  if (!pluggy) {
    return res.status(500).json({ error: 'Pluggy não configurado (PLUGGY_CLIENT_ID / SECRET).' });
  }

  const { data: conn, error: cErr } = await supabase
    .from('bank_connections')
    .select('user_id, item_id')
    .eq('user_id', userId)
    .eq('item_id', trimmed)
    .maybeSingle();

  if (cErr || !conn) {
    return res.status(403).json({ error: 'Conexão bancária não encontrada para este utilizador.' });
  }

  try {
    const { pluggyConnectorId } = await refreshConnectorAndPruneDuplicates(
      supabase,
      pluggy,
      userId,
      trimmed
    );
    if (pluggyConnectorId != null) {
      await supabase
        .from('bank_connections')
        .update({ pluggy_connector_id: pluggyConnectorId, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('item_id', trimmed);
    }
  } catch (e) {
    console.warn('[pluggy/sync-transactions] prune:', e?.message || e);
  }

  try {
    const [result, openFinance] = await Promise.all([
      syncTransactionsForItem(supabase, pluggy, userId, trimmed),
      syncOpenFinanceForItem(supabase, pluggy, userId, trimmed),
    ]);
    const autoLink = await autoLinkPluggyTransactionsForUser(supabase, userId);
    return res.status(200).json({
      ok: true,
      ...result,
      openFinance,
      autoLink: { linked: autoLink.ok ? autoLink.linked : 0, ok: autoLink.ok },
    });
  } catch (e) {
    console.error('[pluggy/sync-transactions]', e);
    return res.status(500).json({ error: e?.message || 'Falha ao sincronizar transações' });
  }
}
