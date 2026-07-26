import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { canAccessAdminRoutes } from '../adminAccess';
import { canAccessForSession } from '../access-server';

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

export async function requireAdminCreditsApi(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    res.status(401).json({ error: 'Faça login.' });
    return null;
  }
  const allowed = await canAccessAdminRoutes(email, () => canAccessForSession(session));
  if (!allowed) {
    res.status(403).json({ error: 'Sem acesso administrativo.' });
    return null;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível.' });
    return null;
  }
  return { supabase, session, email };
}
