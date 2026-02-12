import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

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

function maskUserId(userId) {
  if (!userId || typeof userId !== 'string') return 'Explorador';
  const last4 = userId.replace(/-/g, '').slice(-4);
  return `Explorador #${last4}`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays} dia(s)`;
  return d.toLocaleDateString('pt-BR');
}

/** GET - Lista perguntas (todas ou por viewport). Resposta com user_label anônimo. */
export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('map_questions')
        .select('id, user_id, store_name, lat, lng, message, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      const { lat, lng, radius } = req.query;
      if (lat != null && lng != null && radius != null) {
        const latN = parseFloat(lat);
        const lngN = parseFloat(lng);
        const radiusKm = parseFloat(radius) || 10;
        const latDelta = radiusKm / 111;
        const lngDelta = radiusKm / (111 * Math.cos((latN * Math.PI) / 180));
        query = query
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .gte('lat', latN - latDelta)
          .lte('lat', latN + latDelta)
          .gte('lng', lngN - lngDelta)
          .lte('lng', lngN + lngDelta);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar map_questions:', error);
        return res.status(500).json({ error: error.message });
      }

      const list = (data || []).map((q) => ({
        id: q.id,
        store_name: q.store_name,
        lat: q.lat != null ? Number(q.lat) : null,
        lng: q.lng != null ? Number(q.lng) : null,
        message: q.message,
        time_ago: formatTimeAgo(q.created_at),
        user_label: maskUserId(q.user_id),
      }));

      return res.status(200).json({ questions: list });
    } catch (e) {
      console.error('Erro em GET /api/map/questions:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.supabaseId;
    if (!userId) {
      return res.status(401).json({ error: 'Faça login para publicar uma pergunta' });
    }

    const { message, store_name, lat, lng } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return res.status(400).json({ error: 'Mensagem é obrigatória (mín. 3 caracteres)' });
    }

    try {
      const { data, error } = await supabase
        .from('map_questions')
        .insert({
          user_id: userId,
          store_name: store_name?.trim() || null,
          lat: lat != null && !Number.isNaN(Number(lat)) ? Number(lat) : null,
          lng: lng != null && !Number.isNaN(Number(lng)) ? Number(lng) : null,
          message: message.trim().slice(0, 500),
        })
        .select('id, created_at')
        .single();

      if (error) {
        console.error('Erro ao inserir map_question:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ success: true, id: data.id, created_at: data.created_at });
    } catch (e) {
      console.error('Erro em POST /api/map/questions:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
