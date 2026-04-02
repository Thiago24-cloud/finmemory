import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/pluggy/callback
 * Body: { itemId: string }
 * Persiste a conexão Pluggy (item) para o utilizador autenticado.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({
      error: 'Não autenticado ou perfil incompleto. Faça login novamente.',
    });
  }

  const { itemId } = req.body || {};
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId é obrigatório' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta (Supabase).' });
  }

  const { error } = await supabase.from('bank_connections').upsert(
    {
      user_id: userId,
      item_id: itemId,
    },
    { onConflict: 'user_id,item_id' }
  );

  if (error) {
    console.error('[pluggy/callback]', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
