import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';

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

/** POST - Adiciona uma resposta à pergunta. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Faça login para responder' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const { id } = req.query;
  const { message } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'id da pergunta é obrigatório' });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    return res.status(400).json({ error: 'Mensagem é obrigatória (mín. 2 caracteres)' });
  }

  try {
    const { data: existing } = await supabase
      .from('map_questions')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Pergunta não encontrada' });
    }

    const { data, error } = await supabase
      .from('map_question_replies')
      .insert({
        question_id: id,
        user_id: userId,
        message: message.trim().slice(0, 500),
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Erro ao inserir reply:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, id: data.id, created_at: data.created_at });
  } catch (e) {
    console.error('Erro em POST /api/map/questions/[id]/reply:', e);
    return res.status(500).json({ error: e.message });
  }
}
