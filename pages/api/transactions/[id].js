import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Serviço indisponível' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID da transação é obrigatório' });
  }

  const userId = req.body?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Usuário não identificado' });
  }

  const { data: existing } = await supabase
    .from('transacoes')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ success: false, error: 'Transação não encontrada' });
  }

  if (req.method === 'PATCH') {
    const { estabelecimento, total, data, receipt_image_url: receiptImageUrl } = req.body;
    const updates = {};
    if (estabelecimento != null && String(estabelecimento).trim()) updates.estabelecimento = String(estabelecimento).trim();
    if (total != null && !isNaN(parseFloat(total))) updates.total = parseFloat(total);
    if (data != null && String(data).trim()) updates.data = String(data).trim().slice(0, 10);
    if (receiptImageUrl !== undefined) updates.receipt_image_url = receiptImageUrl === null || receiptImageUrl === '' ? null : receiptImageUrl;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    const { data: updated, error } = await supabase
      .from('transacoes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data: updated });
  }

  if (req.method === 'DELETE') {
    const { error: deleteProdError } = await supabase
      .from('produtos')
      .delete()
      .eq('transacao_id', id);
    if (deleteProdError) {
      console.error('Erro ao deletar produtos:', deleteProdError);
    }

    const { error } = await supabase
      .from('transacoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
