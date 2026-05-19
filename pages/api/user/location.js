import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

/**
 * POST /api/user/location — guarda posição para push de ofertas próximas.
 * Body: { lat, lng, notify_nearby_offers?: boolean }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login para atualizar localização.' });
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Coordenadas inválidas.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const notify =
    typeof req.body?.notify_nearby_offers === 'boolean' ? req.body.notify_nearby_offers : true;

  const row = {
    user_id: userId,
    lat,
    lng,
    updated_at: new Date().toISOString(),
    notify_nearby_offers: notify,
  };

  const { error } = await supabase.from('user_last_locations').upsert(row, { onConflict: 'user_id' });

  if (error) {
    if (error.message?.includes('user_last_locations')) {
      return res.status(503).json({
        error: 'Tabela user_last_locations ausente. Aplique a migração 20260520120000.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, notify_nearby_offers: notify });
}
