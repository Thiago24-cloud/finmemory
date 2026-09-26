/**
 * POST /api/scraper/cleanup-sim-cesta
 * Remove price_points com `[sim-cesta]` (service role no Cloud Run).
 */
import { createClient } from '@supabase/supabase-js';
import { isSimulatedMapProductName } from '../../../lib/mapSimulatedOffers.js';

function requireCronSecret(req) {
  const importSecret =
    process.env.CLEANUP_SIM_CESTA_SECRET ||
    process.env.CRON_SECRET ||
    process.env.DIA_IMPORT_SECRET ||
    process.env.ATACADAO_IMPORT_SECRET;
  const provided =
    req.headers['x-cron-secret'] || req.headers['X-Cron-Secret'] || req.query?.secret;
  if (importSecret && provided !== importSecret) {
    return { ok: false, status: 403, body: { error: 'Forbidden' } };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const gate = requireCronSecret(req);
  if (!gate.ok) return res.status(gate.status).json(gate.body);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let removed = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await supabase
      .from('price_points')
      .select('id, product_name')
      .ilike('product_name', '%[sim-cesta]%')
      .limit(200);
    if (error) return res.status(500).json({ error: error.message, removed });
    if (!data?.length) break;
    const ids = data.filter((r) => isSimulatedMapProductName(r.product_name)).map((r) => r.id);
    if (!ids.length) break;
    const { error: delErr, count } = await supabase
      .from('price_points')
      .delete({ count: 'exact' })
      .in('id', ids);
    if (delErr) return res.status(500).json({ error: delErr.message, removed });
    removed += count ?? ids.length;
  }

  return res.status(200).json({ ok: true, removed });
}
