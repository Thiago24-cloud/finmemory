import { createClient } from '@supabase/supabase-js';

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

/** POST - Incrementa "Obrigado" (thanks) em uma resposta. Body: { reply_id } */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const { id: questionId } = req.query;
  const { reply_id } = req.body || {};
  if (!questionId || !reply_id) {
    return res.status(400).json({ error: 'question id e reply_id são obrigatórios' });
  }

  try {
    const { data: reply, error: fetchErr } = await supabase
      .from('map_question_replies')
      .select('id, thanks_count')
      .eq('id', reply_id)
      .eq('question_id', questionId)
      .single();

    if (fetchErr || !reply) {
      return res.status(404).json({ error: 'Resposta não encontrada' });
    }

    const newCount = (reply.thanks_count || 0) + 1;
    const { error: updateErr } = await supabase
      .from('map_question_replies')
      .update({ thanks_count: newCount })
      .eq('id', reply_id);

    if (updateErr) {
      console.error('Erro ao atualizar thanks:', updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    return res.status(200).json({ success: true, thanks_count: newCount });
  } catch (e) {
    console.error('Erro em POST /api/map/questions/[id]/thanks:', e);
    return res.status(500).json({ error: e.message });
  }
}
