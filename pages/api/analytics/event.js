import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

/**
 * POST /api/analytics/event
 * Body: { event_name: string, page?: string }
 * Requer sessão NextAuth com supabaseId (public.users).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login para registar eventos.' });
  }

  const { event_name: rawName, page: rawPage } = req.body || {};
  if (rawName == null || typeof rawName !== 'string' || !rawName.trim()) {
    return res.status(400).json({ error: 'Informe event_name.' });
  }

  const event_name = rawName.trim().slice(0, 128);
  let page = null;
  if (rawPage != null && typeof rawPage === 'string' && rawPage.trim()) {
    page = rawPage.trim().slice(0, 512);
  }

  try {
    const { error } = await supabase.from('user_events').insert({
      user_id: userId,
      event_name,
      page,
    });
    if (error) {
      console.error('user_events insert:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(204).end();
  } catch (e) {
    console.error('user_events:', e);
    return res.status(500).json({ error: 'Erro ao gravar evento.' });
  }
}
