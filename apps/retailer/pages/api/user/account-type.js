import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  normalizeAccountType,
  userRoleToAccountType,
  accountTypeToUserRole,
  USER_ROLE_CONSUMER,
  USER_ROLE_RETAILER,
} from '../../../lib/userType';

/**
 * GET  — estado da seleção de perfil (consumidor / varejista).
 * POST — grava account_type + account_type_selected_at.
 * Body: { role: 'consumer' | 'retailer' } ou { account_type: 'consumidor' | 'varejista' }
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  if (req.method === 'GET') {
    let data = null;
    let error = null;
    let legacySchema = false;

    ({ data, error } = await supabase
      .from('users')
      .select('account_type, account_type_selected_at, account_type_chosen_explicitly')
      .eq('id', userId)
      .maybeSingle());

    if (error?.message?.includes('account_type_chosen_explicitly')) {
      legacySchema = true;
      ({ data, error } = await supabase
        .from('users')
        .select('account_type, account_type_selected_at')
        .eq('id', userId)
        .maybeSingle());
    }

    if (error) {
      console.warn('[account-type GET]', error.message);
      // Coluna em falta ou schema antigo: forçar tela de escolha
      if (error.message?.includes('account_type')) {
        return res.status(200).json({
          needsSelection: true,
          account_type: 'consumidor',
          userRole: accountTypeToUserRole('consumidor'),
          selected_at: null,
        });
      }
      return res.status(500).json({ error: 'Não foi possível ler o perfil.' });
    }

    const accountType = normalizeAccountType(data?.account_type);
    const needsSelection = legacySchema
      ? true
      : data?.account_type_chosen_explicitly === true
        ? false
        : true;

    return res.status(200).json({
      needsSelection,
      account_type: accountType,
      userRole: accountTypeToUserRole(accountType),
      selected_at: data?.account_type_selected_at || null,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  let accountType = null;
  if (body.role === USER_ROLE_RETAILER || body.role === USER_ROLE_CONSUMER) {
    accountType = userRoleToAccountType(body.role);
  } else if (body.account_type) {
    accountType = normalizeAccountType(body.account_type);
  }

  if (!accountType) {
    return res.status(400).json({ error: 'Informe role (consumer|retailer) ou account_type.' });
  }

  const now = new Date().toISOString();
  const displayName = String(body.display_name || '').trim();
  const patch = {
    account_type: accountType,
    account_type_selected_at: now,
    account_type_chosen_explicitly: true,
  };
  if (displayName.length >= 2 && displayName.length <= 120) {
    patch.name = displayName;
    patch.profile_first_login_completed_at = now;
  }

  let { error: dbErr } = await supabase.from('users').update(patch).eq('id', userId);

  if (dbErr?.message?.includes('account_type_chosen_explicitly')) {
    const { account_type_chosen_explicitly: _drop, ...legacyPatch } = patch;
    ({ error: dbErr } = await supabase.from('users').update(legacyPatch).eq('id', userId));
  }

  if (dbErr) {
    console.error('[account-type POST]', dbErr.message);
    return res.status(500).json({ error: 'Não foi possível salvar o perfil.' });
  }

  return res.status(200).json({
    ok: true,
    account_type: accountType,
    userRole: accountTypeToUserRole(accountType),
    selected_at: now,
  });
}
