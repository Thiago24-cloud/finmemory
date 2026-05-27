import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Consumidor logado (não varejista) para criar/acompanhar pedidos.
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export async function requireConsumerSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;

  if (!email || !userId) {
    res.status(401).json({ error: 'Faça login para fazer o pedido.' });
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível' });
    return null;
  }

  return { supabase, session, userId, email };
}
