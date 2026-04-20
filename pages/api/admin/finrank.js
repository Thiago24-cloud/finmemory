import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { isFinmemoryAdminEmail } from '../../../lib/adminAccess';

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
 * GET /api/admin/finrank
 * Exporta ranking semanal (view public.weekly_finrank).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email || !isFinmemoryAdminEmail(email)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data, error } = await supabase.from('weekly_finrank').select('*').limit(50);

  if (error) {
    console.warn('admin finrank:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ rows: data || [] });
}
