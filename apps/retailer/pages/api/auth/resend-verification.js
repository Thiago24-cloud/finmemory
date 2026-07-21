import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { normalizeEmail } from '../../../lib/securityPolicy';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';

/** Stub: no retailer o cadastro já marca email como verificado. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Configuração indisponível' });

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({ bucket: 'resend-ip', key: ip, limit: 15, windowMs: 60 * 60 * 1000 });
  if (!ipRate.allowed) return res.status(429).json({ error: 'Muitas tentativas.' });

  normalizeEmail(req.body?.email);
  return res.status(200).json({ ok: true });
}
