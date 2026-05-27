import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { mintSupabaseAccessToken } from '@finmemory/shared/supabase/mintAccessToken';

/**
 * GET /api/supabase/realtime-token
 * Emite JWT curto para Supabase Realtime (sub = users.id da sessão NextAuth).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({
      error: 'Realtime indisponível',
      code: 'SUPABASE_JWT_SECRET_MISSING',
    });
  }

  try {
    const access_token = mintSupabaseAccessToken(String(userId), secret, 3600);
    return res.status(200).json({ access_token, expires_in: 3600 });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Erro ao emitir token' });
  }
}
