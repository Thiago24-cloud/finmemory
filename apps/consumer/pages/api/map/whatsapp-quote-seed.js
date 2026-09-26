/**
 * POST /api/map/whatsapp-quote-seed
 * Demo SP (cesta básica) — só admin FinMemory.
 */
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '../auth/[...nextauth]';
import { isFinmemoryAdminEmail, hasFinmemoryAdminAllowlist } from '../../../lib/adminAccess';
import { seedWhatsappQuoteDemo } from '../../../lib/seedWhatsappQuoteDemo';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: 'Faça login.' });
  if (!hasFinmemoryAdminAllowlist() || !isFinmemoryAdminEmail(email)) {
    return res.status(403).json({ error: 'Só admin FinMemory pode carregar a demo.' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const result = await seedWhatsappQuoteDemo(supabase);
  if (!result.ok) {
    return res.status(500).json({ error: result.error || 'Falha ao carregar demo.' });
  }
  return res.status(200).json(result);
}
