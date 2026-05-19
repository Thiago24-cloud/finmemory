import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { normalizeAccountType, ACCOUNT_TYPE_VAREJISTA } from '../userType';
import { ensureMerchantStoreLink } from './ensureMerchantStoreLink';

/**
 * Sessão varejista sem exigir loja vinculada (ex.: repair-link).
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export async function requireMerchantSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;

  if (!email || !userId) {
    res.status(401).json({ error: 'Faça login para acessar o painel da loja.' });
    return null;
  }

  const accountType = normalizeAccountType(session.user.account_type);
  if (accountType !== ACCOUNT_TYPE_VAREJISTA) {
    res.status(403).json({ error: 'Esta área é exclusiva para contas de lojista parceiro.' });
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível' });
    return null;
  }

  return { supabase, session, userId, email };
}

/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export async function requireMerchantApi(req, res) {
  const base = await requireMerchantSession(req, res);
  if (!base) return null;

  const { supabase, session, userId, email } = base;
  const ctx = await ensureMerchantStoreLink(supabase, userId);
  if (!ctx?.store?.id) {
    res.status(404).json({
      code: 'MERCHANT_STORE_NOT_LINKED',
      error: 'Nenhuma loja vinculada a esta conta. Conclua o cadastro em /parceiros.',
    });
    return null;
  }

  return {
    supabase,
    session,
    userId,
    email,
    store: ctx.store,
    profile: ctx.profile,
    usuarioLoja: ctx.usuarioLoja,
  };
}
