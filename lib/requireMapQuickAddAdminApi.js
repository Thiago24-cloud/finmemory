import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { canAccess } from './access-server';
import { hasFinmemoryAdminAllowlist, isFinmemoryAdminEmail } from './adminAccess';
import { getMapQuickAddSupabase, resolveQuickAddAuth } from './mapQuickAddCore';

/**
 * Auth igual ao painel Quick Add / regras de miniatura (sessão admin ou x-map-quick-add-secret).
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {Promise<{ supabase: import('@supabase/supabase-js').SupabaseClient } | null>}
 */
export async function requireMapQuickAddAdminForApi(req, res) {
  const supabase = getMapQuickAddSupabase();
  if (!supabase) {
    res.status(500).json({ error: 'Servidor sem Supabase (service role).' });
    return null;
  }
  const session = await getServerSession(req, res, authOptions);
  const auth = resolveQuickAddAuth(req, session);
  if (auth?.error === 'invalid_secret') {
    res.status(403).json({ error: 'x-map-quick-add-secret inválido.' });
    return null;
  }
  if (auth?.error === 'secret_not_configured') {
    res.status(503).json({ error: 'MAP_QUICK_ADD_SECRET não configurado.' });
    return null;
  }
  if (auth?.error === 'bot_user_missing') {
    res.status(503).json({ error: 'MAP_QUICK_ADD_BOT_USER_ID em falta.' });
    return null;
  }
  if (!auth?.userId) {
    res.status(401).json({ error: 'Faça login ou envie x-map-quick-add-secret válido.' });
    return null;
  }
  if (auth.via === 'session' && session?.user?.email) {
    if (hasFinmemoryAdminAllowlist()) {
      if (!isFinmemoryAdminEmail(session.user.email)) {
        res.status(403).json({ error: 'Acesso restrito ao painel operacional.' });
        return null;
      }
    } else {
      const allowed = await canAccess(session.user.email);
      if (!allowed) {
        res.status(403).json({ error: 'Sem permissão.' });
        return null;
      }
    }
  }
  return { supabase };
}
