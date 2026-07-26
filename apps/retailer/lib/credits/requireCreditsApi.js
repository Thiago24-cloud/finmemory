import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { requireAdmCompraApi } from '../adm/admCompra';

export async function requireUserCreditsApi(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    res.status(401).json({ error: 'Faça login para acessar sua carteira.' });
    return null;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível.' });
    return null;
  }
  return { supabase, session, userId };
}

/** Admin créditos — mesmo guard do ADM FinMemory Compra (FINMEMORY_ADMIN_EMAILS). */
export async function requireAdminCreditsApi(req, res) {
  return requireAdmCompraApi(req, res);
}
