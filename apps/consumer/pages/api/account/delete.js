import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { normalizeEmail } from '../../../lib/securityPolicy';

/**
 * DELETE /api/account/delete
 * Remove a conta autenticada e dados associados (Supabase service role).
 */
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const emailRaw = session?.user?.email;
  if (!userId || !emailRaw) {
    return res.status(401).json({ error: 'Faça login para excluir a conta.' });
  }

  const email = normalizeEmail(emailRaw);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Servidor sem Supabase (service role).' });
  }

  const { data: userRow, error: userLookupErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle();

  if (userLookupErr || !userRow) {
    return res.status(404).json({ error: 'Utilizador não encontrado.' });
  }
  if (normalizeEmail(userRow.email || '') !== email) {
    return res.status(403).json({ error: 'Sessão inválida para esta conta.' });
  }

  /** @param {string} label */
  const del = async (label, fn) => {
    try {
      const result = await fn();
      const error = result?.error;
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
          console.warn(`[account/delete] ${label}:`, error.message);
        }
      }
    } catch (e) {
      console.warn(`[account/delete] ${label}:`, e?.message || e);
    }
  };

  try {
    // Storage: imagens de recibos (pasta por user_id)
    await del('storage receipts', async () => {
      const { data: files, error: listErr } = await supabase.storage.from('receipts').list(userId, { limit: 500 });
      if (listErr) return { error: listErr };
      if (!files?.length) return { error: null };
      const paths = files.map((f) => `${userId}/${f.name}`);
      return supabase.storage.from('receipts').remove(paths);
    });

    await del('map_question_replies', () => supabase.from('map_question_replies').delete().eq('user_id', userId));
    await del('map_questions', () => supabase.from('map_questions').delete().eq('user_id', userId));

    await del('bank_transactions', () => supabase.from('bank_transactions').delete().eq('user_id', userId));
    await del('bank_accounts', () => supabase.from('bank_accounts').delete().eq('user_id', userId));
    await del('bank_connections', () => supabase.from('bank_connections').delete().eq('user_id', userId));

    await del('transacoes', () => supabase.from('transacoes').delete().eq('user_id', userId));

    await del('manual_credit_cards', () => supabase.from('manual_credit_cards').delete().eq('user_id', userId));
    await del('cobrancas_pagamentos', () => supabase.from('cobrancas_pagamentos').delete().eq('user_id', userId));
    await del('cobrancas', () => supabase.from('cobrancas').delete().eq('user_id', userId));
    await del('user_events', () => supabase.from('user_events').delete().eq('user_id', userId));
    await del('price_confirmations', () => supabase.from('price_confirmations').delete().eq('app_user_id', userId));
    await del('financial_simulator_state', () =>
      supabase.from('financial_simulator_state').delete().eq('user_id', userId)
    );

    await del('partnership_members', () => supabase.from('partnership_members').delete().eq('user_id', userId));
    await del('partnerships', () =>
      supabase.from('partnerships').delete().or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    );

    await del('shopping_list_items (owner)', () =>
      supabase.from('shopping_list_items').delete().eq('owner_user_id', userId)
    );
    await del('shopping_lists (owner)', () => supabase.from('shopping_lists').delete().eq('owner_user_id', userId));

    await del('auth_local_users', () => supabase.from('auth_local_users').delete().eq('user_id', userId));
    await del('auth_local_users by email', () => supabase.from('auth_local_users').delete().eq('email', email));
    await del('profiles by user_id', () => supabase.from('profiles').delete().eq('user_id', userId));
    await del('profiles by email', () => supabase.from('profiles').delete().eq('email', email));
    await del('signups', () => supabase.from('signups').delete().eq('email', email));

    const { error: delUserErr } = await supabase.from('users').delete().eq('id', userId);
    if (delUserErr) {
      console.error('[account/delete] users:', delUserErr.message);
      return res.status(500).json({ error: delUserErr.message || 'Não foi possível remover a conta.' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('[account/delete]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Erro ao excluir conta.' });
  }
}
