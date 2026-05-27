import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { autoLinkPluggyTransactionsForUser } from '../../../lib/autoLinkPluggyTransactions';

/**
 * POST /api/transactions/auto-link-pluggy
 * Liga notas (transacoes) sem pluggy_transaction_id a movimentos bank_transactions
 * quando há correspondência **única** por data civil + valor (tolerância igual ao histórico unificado).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Não autenticado ou perfil incompleto.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: 'Configuração do servidor incompleta.' });
  }

  const result = await autoLinkPluggyTransactionsForUser(supabase, userId);
  if (!result.ok) {
    return res.status(500).json({ ok: false, error: result.error || 'Falha ao parear.' });
  }
  return res.status(200).json({ ok: true, linked: result.linked, details: result.details });
}
