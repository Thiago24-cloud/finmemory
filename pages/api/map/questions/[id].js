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

/** GET - Uma pergunta com respostas (para popup no mapa). */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'id é obrigatório' });
  }

  try {
    const { data: question, error: qErr } = await supabase
      .from('map_questions')
      .select('id, user_id, store_name, lat, lng, message, created_at')
      .eq('id', id)
      .single();

    if (qErr || !question) {
      return res.status(404).json({ error: 'Pergunta não encontrada' });
    }

    const { data: replies, error: rErr } = await supabase
      .from('map_question_replies')
      .select('id, user_id, message, thanks_count, created_at')
      .eq('question_id', id)
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('Erro ao buscar respostas:', rErr);
    }

    const out = {
      id: question.id,
      store_name: question.store_name,
      lat: question.lat != null ? Number(question.lat) : null,
      lng: question.lng != null ? Number(question.lng) : null,
      message: question.message,
      time_ago: formatTimeAgo(question.created_at),
      user_label: maskUserId(question.user_id),
      replies: (replies || []).map((r) => ({
        id: r.id,
        message: r.message,
        thanks_count: r.thanks_count || 0,
        time_ago: formatTimeAgo(r.created_at),
        user_label: maskUserId(r.user_id),
      })),
    };

    return res.status(200).json(out);
  } catch (e) {
    console.error('Erro em GET /api/map/questions/[id]:', e);
    return res.status(500).json({ error: e.message });
  }
}
